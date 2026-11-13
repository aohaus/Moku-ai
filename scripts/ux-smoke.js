#!/usr/bin/env node
/**
 * Moku UX smoke check — the "eyes" of the Play Detective (CLAUDE.md §9).
 *
 * Opens the hub and every game on three screen sizes (iPhone portrait,
 * iPad landscape, desktop), logged in through the `npm run dev` mock, and
 * records for each page:
 *   - console errors / uncaught exceptions / failed requests
 *   - a bounce to the login page (gate problem)
 *   - horizontal page scroll (something sticks out sideways)
 *   - visible buttons/links that are cut off by the screen edge
 *   - a screenshot (for a person or the Detective to look at)
 *
 * Read-only: it changes no files in the repo. Output goes to
 * .ux-cycle/<YYYY-MM-DD>/ (gitignored): report.json, report.md, shots/*.png
 *
 *   node scripts/ux-smoke.js                     # everything
 *   node scripts/ux-smoke.js moku-drop moyomoyo  # only these pages
 *   UX_SMOKE_DEVICES=iphone node scripts/ux-smoke.js moku-kart
 *   UX_SMOKE_WAIT=4000 node scripts/ux-smoke.js  # wait longer per page (ms)
 *
 * If nothing is listening on http://localhost:3000 it starts server.js itself
 * and stops it at the end. The page must be on port 3000 so the login gate
 * and the account mock behave the same as for players.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'http://localhost:3000';
const WAIT_MS = parseInt(process.env.UX_SMOKE_WAIT, 10) || 2500;

const DEVICES = {
  iphone: { label: 'iPhone portrait', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  ipad: { label: 'iPad landscape', viewport: { width: 1024, height: 768 }, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  desktop: { label: 'Desktop', viewport: { width: 1440, height: 900 } },
};

// Games come from the hub's CATALOG (the source of truth, CLAUDE.md §2).
function pageList() {
  const hub = fs.readFileSync(path.join(ROOT, 'hub.html'), 'utf8');
  const ids = [];
  const re = /^\s*\w+:\s*\{\s*name:\s*'[^']*',\s*gameId:\s*'([a-z0-9-]+)'/gm;
  let m;
  while ((m = re.exec(hub))) if (!ids.includes(m[1])) ids.push(m[1]);
  // Special Events (hub.html EVENTS, SPEC.md §15): { name: '…', gameId: 'event-…' }
  const ev = /\{\s*name:\s*'[^']*',\s*gameId:\s*'(event-[a-z0-9-]+)'/g;
  while ((m = ev.exec(hub))) if (!ids.includes(m[1])) ids.push(m[1]);
  return ['index', 'hub'].concat(ids).filter((id) => fs.existsSync(path.join(ROOT, id + '.html')));
}

async function isUp() {
  try { return (await fetch(BASE + '/api/health')).ok; } catch (e) { return false; }
}

// A fresh checkout (e.g. the weekly scheduled run) may not have run
// `npm install` yet; server.js needs express. Install once if it's missing.
function ensureDeps() {
  try { require.resolve('express', { paths: [ROOT] }); return; } catch (e) { /* install below */ }
  console.log('node_modules missing: running npm install …');
  require('child_process').execSync('npm install --no-audit --no-fund --silent', { cwd: ROOT, stdio: 'inherit' });
}

async function startServer() {
  if (await isUp()) return null;
  ensureDeps();
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    if (await isUp()) return child;
    await new Promise((r) => setTimeout(r, 200));
  }
  child.kill();
  throw new Error('server.js did not start on port 3000');
}

// A throwaway player on the in-memory mock (invite code from backend/dev/mount.js).
async function devSession() {
  const loginId = 'uxsmoke' + Date.now().toString(36).slice(-6);
  const res = await fetch(BASE + '/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ inviteCode: process.env.MOKU_INVITE_CODE || 'moku-dev', loginId, pin: '2468', displayName: 'UX Smoke' }),
  });
  if (!res.ok) throw new Error('mock register failed: ' + res.status + ' ' + (await res.text()));
  return res.json();
}

// Runs in the page after load. Keep it plain ES5-ish: it is serialized.
function inspectPage() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const doc = document.scrollingElement || document.documentElement;
  const out = { sideScroll: doc.scrollWidth > W + 1 ? doc.scrollWidth - W : 0, clipped: [] };
  const els = document.querySelectorAll('button, a[href], [role="button"], input, select');
  for (const el of els) {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    // Only things meant to be on screen right now (fixed/sticky UI, or in the first screenful).
    // Skip things inside a sideways-scrolling row (hub shelves etc.): you swipe to them.
    let fixed = false;
    let inScroller = false;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (/(auto|scroll)/.test(ps.overflowX) && p.scrollWidth > p.clientWidth + 1) { inScroller = true; break; }
      if (ps.position === 'fixed' || ps.position === 'sticky') fixed = true;
    }
    if (inScroller) continue;
    if (!fixed && getComputedStyle(el).position === 'fixed') fixed = true;
    if (!fixed && r.top > H) continue;
    const off = r.left < -1 || r.right > W + 1 || (fixed && (r.top < -1 || r.bottom > H + 1));
    if (!off) continue;
    const text = (el.innerText || el.getAttribute('aria-label') || el.id || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
    out.clipped.push({ text, left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom) });
    if (out.clipped.length >= 8) break;
  }
  return out;
}

async function checkPage(context, id, deviceKey, shotsDir) {
  const page = await context.newPage();
  const issues = { errors: [], failedRequests: [] };
  page.on('console', (msg) => { if (msg.type() === 'error') issues.errors.push(msg.text().slice(0, 300)); });
  page.on('pageerror', (e) => issues.errors.push('Uncaught: ' + String(e && e.message || e).slice(0, 300)));
  page.on('requestfailed', (req) => {
    const url = req.url();
    if (/\/errors$/.test(url)) return; // moku-errors.js reporting is not itself a problem
    issues.failedRequests.push(url.slice(0, 160) + ' (' + ((req.failure() || {}).errorText || '?') + ')');
  });
  const url = BASE + '/' + id + '.html';
  let loadError = null;
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 20000 });
  } catch (e) {
    loadError = String(e.message || e).split('\n')[0];
  }
  await page.waitForTimeout(WAIT_MS);
  const finalPath = new URL(page.url()).pathname.split('/').pop();
  const bounced = id !== 'index' && finalPath === 'index.html';
  let layout = { sideScroll: 0, clipped: [] };
  try { layout = await page.evaluate(inspectPage); } catch (e) { issues.errors.push('inspect failed: ' + e.message); }
  const shot = path.join(shotsDir, id + '--' + deviceKey + '.png');
  try { await page.screenshot({ path: shot }); } catch (e) { /* ignore */ }
  await page.close();
  // A library CDN this machine cannot reach (sandbox network rules) is not a
  // game bug; report the run as "could not check here" instead.
  const blocked = issues.failedRequests.filter((u) => !u.startsWith(BASE) && /ERR_(TUNNEL|PROXY|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|CONNECTION)/.test(u));
  return {
    page: id, device: deviceKey, loadError, bouncedToLogin: bounced, cdnBlocked: blocked,
    errors: [...new Set(issues.errors)], failedRequests: [...new Set(issues.failedRequests)],
    sideScroll: layout.sideScroll, clipped: layout.clipped,
    screenshot: path.relative(ROOT, shot),
  };
}

function problemsOf(r) {
  const p = [];
  if (r.cdnBlocked.length) return p; // listed separately, see toMarkdown
  if (r.loadError) p.push('load: ' + r.loadError);
  if (r.bouncedToLogin) p.push('sent to the login page (gate)');
  r.errors.forEach((e) => p.push('console: ' + e));
  r.failedRequests.forEach((e) => p.push('request failed: ' + e));
  if (r.sideScroll) p.push('page scrolls sideways by ' + r.sideScroll + 'px');
  r.clipped.forEach((c) => p.push('cut off: "' + c.text + '" (x ' + c.left + '..' + c.right + ', y ' + c.top + '..' + c.bottom + ')'));
  return p;
}

function toMarkdown(results, meta) {
  const lines = ['# UX smoke ' + meta.date, '', '- commit: `' + meta.commit + '`', '- pages: ' + meta.pages + ' × devices: ' + meta.devices.join(', '), ''];
  const bad = results.filter((r) => problemsOf(r).length);
  lines.push('**' + bad.length + ' / ' + results.length + ' page×device runs have something to look at.**', '');
  const byPage = {};
  bad.forEach((r) => { (byPage[r.page] = byPage[r.page] || []).push(r); });
  Object.keys(byPage).forEach((pg) => {
    lines.push('## ' + pg);
    byPage[pg].forEach((r) => {
      lines.push('- **' + DEVICES[r.device].label + '** — `' + r.screenshot + '`');
      problemsOf(r).forEach((p) => lines.push('  - ' + p));
    });
    lines.push('');
  });
  const blocked = [...new Set(results.filter((r) => r.cdnBlocked.length).map((r) => r.page))];
  if (blocked.length) {
    lines.push('## Could not check here (library CDN unreachable from this machine)', '',
      blocked.join(', '), '', 'Open these on a real device or a machine that can reach the CDN. Blocked: ' +
      [...new Set(results.flatMap((r) => r.cdnBlocked).map((u) => u.split(' ')[0]))].join(', '), '');
  }
  const ok = [...new Set(results.map((r) => r.page))].filter((pg) => !byPage[pg] && !blocked.includes(pg));
  if (ok.length) lines.push('## No problems found', '', ok.join(', '), '');
  return lines.join('\n');
}

async function main() {
  const only = process.argv.slice(2);
  const pages = only.length ? only : pageList();
  const deviceKeys = (process.env.UX_SMOKE_DEVICES || 'iphone,ipad,desktop').split(',').filter((k) => DEVICES[k]);
  const date = new Date().toISOString().slice(0, 10);
  const outDir = path.join(ROOT, '.ux-cycle', date);
  const shotsDir = path.join(outDir, 'shots');
  fs.mkdirSync(shotsDir, { recursive: true });

  const server = await startServer();
  const browser = await chromium.launch();
  const results = [];
  try {
    const session = await devSession();
    for (const key of deviceKeys) {
      const d = DEVICES[key];
      const context = await browser.newContext({ viewport: d.viewport, isMobile: !!d.isMobile, hasTouch: !!d.hasTouch, userAgent: d.userAgent, deviceScaleFactor: 1 });
      await context.addInitScript(([token, user]) => {
        try {
          if (!localStorage.getItem('moku:account:token')) {
            localStorage.setItem('moku:account:token', token);
            localStorage.setItem('moku:account:user', user);
          }
        } catch (e) { /* ignore */ }
      }, [session.token, JSON.stringify(session.user)]);
      for (const id of pages) {
        const r = await checkPage(context, id, key, shotsDir);
        results.push(r);
        const n = problemsOf(r).length;
        process.stdout.write((r.cdnBlocked.length ? '⏸  ' : n ? '⚠️ ' : '✅ ') + id + ' @ ' + key + (n ? ' (' + n + ')' : '') + '\n');
      }
      await context.close();
    }
  } finally {
    await browser.close();
    if (server) server.kill();
  }

  let commit = '?';
  try { commit = require('child_process').execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch (e) { /* ignore */ }
  const meta = { date, commit, pages: pages.length, devices: deviceKeys };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ meta, results }, null, 2));
  fs.writeFileSync(path.join(outDir, 'report.md'), toMarkdown(results, meta));
  console.log('\nReport: ' + path.relative(ROOT, path.join(outDir, 'report.md')));
}

main().catch((e) => { console.error(e); process.exit(1); });
