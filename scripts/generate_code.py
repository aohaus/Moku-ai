import glob
import os
import re
from google import genai

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

gemini_md = ""
if os.path.exists("GEMINI.md"):
    with open("GEMINI.md", "r", encoding="utf-8") as f:
        gemini_md = f.read()

code_files = glob.glob("**/*.html", recursive=True) + glob.glob(
    "**/*.js", recursive=True
)
target_file = code_files[0] if code_files else "index.html"

original_code = ""
if os.path.exists(target_file):
    with open(target_file, "r", encoding="utf-8") as f:
        original_code = f.read()

prompt = f"""
プロジェクト方針 (GEMINI.md):
{gemini_md}

対象ファイル ({target_file}) の現状コード:
{original_code}

【超厳格なルール】
1. 既存のHTML構造、CSSスタイル、背景描画、キャラクター描画（フクロウ、ネズミ、夕焼け等）のコードは【絶対に1行も削除・省略】しないでください。
2. コードを短縮・省略・簡略化することは厳禁です。必ず元のコードの全行を保持した上で、新機能や演出を追加してください。
3. 既存の世界観・グラフィックを100%保ったまま、控えめな機能・演出（サウンド、スコア加算ロジック、エフェクト等）のみを追加・修正してください。
4. 以下のフォーマットを厳格に守って出力してください。

===EXPLANATION===
## 概要
（今回の改善全体の意図を1文で簡潔に記述）

## 主な変更点
* （変更点1）
* （変更点2）

## 詳細補足
（各改修内容に関する補足や狙い、期待される効果などの解説）

===CODE===
（省略なしの完全なコードのみを出力）
"""

response = client.models.generate_content(
    model="gemini-3.6-flash", contents=prompt
)

if response.text and "===CODE===" in response.text:
    parts = response.text.split("===CODE===")
    explanation = parts[0].replace("===EXPLANATION===", "").strip()
    raw_code = parts[1].strip()

    cleaned_code = re.sub(
        r"^```[a-zA-Z]*\n", "", raw_code, flags=re.MULTILINE
    )
    cleaned_code = re.sub(r"\n```$", "", cleaned_code, flags=re.MULTILINE)

    # 【安全装置】元のコードより大幅に短くなっている（省略されている）場合は採用しない
    if len(cleaned_code) < len(original_code) * 0.8:
        print(
            "Error: AI attempted to truncate or strip existing visual components."
        )
    else:
        with open(target_file, "w", encoding="utf-8") as f:
            f.write(cleaned_code)

        with open("pr_body.txt", "w", encoding="utf-8") as f:
            f.write(explanation)
