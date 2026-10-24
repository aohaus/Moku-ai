#!/usr/bin/env python3
"""Build the Moku Series app icons and favicons from brand/mokumoku-hero.png.

    python3 scripts/make-icons.py        # run from the repo root (needs Pillow)

Writes:
  icons/icon-512.png, icons/icon-192.png   home-screen icon (manifest "any")
  icons/icon-maskable-512.png              Android adaptive icon (owl inside the 80% safe zone)
  icons/apple-touch-icon.png               iPhone / iPad home screen, 180x180
  icons/favicon-32.png, favicon.ico        browser tab (16/32/48/64): Moku's face only

Look: Moku on a warm sunset gradient (Gemini-era world rule: sunset, warm,
picture-book). Small sizes use a face close-up so it still reads at 16px.
"""
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HERO = os.path.join(ROOT, 'brand', 'mokumoku-hero.png')

# Peach → coral → dusk purple.
SUNSET = [(0.0, (255, 214, 140)), (0.45, (255, 150, 110)), (1.0, (120, 70, 150))]

hero = Image.open(HERO).convert('RGBA')
hero = hero.crop(hero.getchannel('A').getbbox())  # drop the empty rows above the head


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def sunset(size):
    w, h = size
    img = Image.new('RGB', size)
    px = img.load()
    for y in range(h):
        t = y / (h - 1)
        for (p0, c0), (p1, c1) in zip(SUNSET, SUNSET[1:]):
            if p0 <= t <= p1:
                col = lerp(c0, c1, (t - p0) / (p1 - p0))
                break
        for x in range(w):
            px[x, y] = col
    return img.convert('RGBA')


def soft_glow(img, cx, cy, r, color, alpha):
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (alpha,))
    img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(r * 0.45)))


def app_icon(size, owl_scale, center_y=0.53):
    """Full-bleed square (the OS rounds the corners)."""
    canvas = sunset((size, size))
    soft_glow(canvas, size // 2, int(size * 0.42), int(size * 0.42), (255, 240, 200), 150)
    w = int(size * owl_scale)
    h = int(hero.size[1] * w / hero.size[0])
    owl = hero.resize((w, h), Image.LANCZOS)
    x, y = (size - w) // 2, int(size * center_y - h / 2)
    shadow = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    shadow.paste(Image.new('RGBA', owl.size, (60, 20, 40, 255)), (x, y + int(size * 0.02)),
                 owl.getchannel('A').point(lambda v: int(v * 0.35)))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(size * 0.02)))
    canvas.alpha_composite(owl, (x, y))
    return canvas


def face_icon(size):
    """Round tab icon: Moku's head filling a sunset circle."""
    big = 512
    mask = Image.new('L', (big, big), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, big - 1, big - 1], fill=255)
    out = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    out.paste(sunset((big, big)), (0, 0), mask)
    W, H = hero.size
    side = int(W * 0.80)
    head = hero.crop((int(W * 0.10), 0, int(W * 0.10) + side, side))
    head = head.resize((int(big * 0.96), int(big * 0.96)), Image.LANCZOS)
    layer = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    layer.alpha_composite(head, ((big - head.size[0]) // 2, int(big * 0.07)))
    clipped = Image.composite(layer.getchannel('A'), Image.new('L', (big, big), 0), mask)
    out.paste(layer, (0, 0), clipped)
    return out.resize((size, size), Image.LANCZOS)


def save_png(img, rel):
    img.save(os.path.join(ROOT, rel), optimize=True)
    print('wrote', rel)


def main():
    big = app_icon(1024, 0.86)
    for size, rel in [(512, 'icons/icon-512.png'), (192, 'icons/icon-192.png')]:
        save_png(big.resize((size, size), Image.LANCZOS), rel)
    # iOS needs an opaque image and rounds the corners itself.
    save_png(big.resize((180, 180), Image.LANCZOS).convert('RGB'), 'icons/apple-touch-icon.png')
    # Android masks to anything from a circle to a square: keep the owl in the 80% circle.
    save_png(app_icon(1024, 0.64).resize((512, 512), Image.LANCZOS), 'icons/icon-maskable-512.png')

    face = face_icon(256)
    save_png(face.resize((32, 32), Image.LANCZOS), 'icons/favicon-32.png')
    face.save(os.path.join(ROOT, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    print('wrote favicon.ico')


if __name__ == '__main__':
    main()
