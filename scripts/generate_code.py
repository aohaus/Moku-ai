import glob
import os
import re
from google import genai

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

# GEMINI.mdの確認
gemini_md = ""
if os.path.exists("GEMINI.md"):
    with open("GEMINI.md", "r", encoding="utf-8") as f:
        gemini_md = f.read()

# 修正対象ファイルの検索
code_files = glob.glob("**/*.html", recursive=True) + glob.glob(
    "**/*.js", recursive=True
)
target_file = code_files[0] if code_files else "index.html"

code_context = ""
if os.path.exists(target_file):
    with open(target_file, "r", encoding="utf-8") as f:
        code_context = f.read()[:4000]

prompt = f"""
プロジェクト方針 (GEMINI.md):
{gemini_md}

対象ファイル ({target_file}) の現状コード:
{code_context}

【重要指示】
1. 上記コードの**既存の世界観（背景色、グラフィック、配色、温かみのある雰囲気）を100%維持**してください。
2. 背景色や全体デザインの大幅な変更、サイバー風・ネオン調・ダークモード化などの世界観を損なう変更は【絶対禁止】です。
3. 既存のキャラクターやテーマを尊重し、ゲーム性が少し増すような「控えめな機能追加」または「自然な演出強化」を1つだけ実施してください。
4. 以下のフォーマットを厳格に守って説明文とコードを出力してください。

===EXPLANATION===
## 概要
（今回の改善全体の意図を1文で簡潔に記述）

## 主な変更点
* （変更点1）
* （変更点2）

## 詳細補足
（各改修内容に関する補足や狙い、期待される効果などの解説）

===CODE===
（ここにバックティックス無しの完成版コードのみを出力）
"""

response = client.models.generate_content(
    model="gemini-3.6-flash", contents=prompt
)

if response.text and "===CODE===" in response.text:
    parts = response.text.split("===CODE===")
    explanation = parts[0].replace("===EXPLANATION===", "").strip()
    raw_code = parts[1].strip()

    # マークダウン装飾（```html や ``` など）を除去
    cleaned_code = re.sub(
        r"^```[a-zA-Z]*\n", "", raw_code, flags=re.MULTILINE
    )
    cleaned_code = re.sub(r"\n```$", "", cleaned_code, flags=re.MULTILINE)

    # コード上書き
    with open(target_file, "w", encoding="utf-8") as f:
        f.write(cleaned_code)

    # PR説明文の出力
    with open("pr_body.txt", "w", encoding="utf-8") as f:
        f.write(explanation)
