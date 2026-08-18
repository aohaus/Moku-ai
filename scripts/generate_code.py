import glob
import os
import re
from google import genai

# Gemini APIクライアントの初期化
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

# GEMINI.mdの確認
gemini_md = ""
if os.path.exists("GEMINI.md"):
    with open("GEMINI.md", "r", encoding="utf-8") as f:
        gemini_md = f.read()

# 修正対象ファイルの検索 (HTML / JS / TS)
code_files = glob.glob("**/*.html", recursive=True) + glob.glob(
    "**/*.js", recursive=True
)
target_file = code_files[0] if code_files else "index.html"

code_context = ""
if os.path.exists(target_file):
    with open(target_file, "r", encoding="utf-8") as f:
        code_context = f.read()[:4000]

# プロンプトの組み立て
prompt = f"""
プロジェクト方針 (GEMINI.md):
{gemini_md}

対象ファイル ({target_file}) の現状コード:
{code_context}

【指示】
上記の対象ファイル ({target_file}) をベースに、ゲームをより面白くする『新しい機能、UIの改善、CSSアニメーション、または演出』を必ず1つ以上追加・修正したコードを生成してください。
元コードと全く同じ内容を出力することは禁止です。

※注意事項:
- コード以外の解説文やバックティックス(```)は一切含めず、ファイル全体の完成版コードのみを出力してください。
"""

response = client.models.generate_content(
    model="gemini-3.6-flash", contents=prompt
)

if response.text and len(response.text.strip()) > 0:
    # マークダウン装飾（```html や ``` など）を除去
    cleaned_code = re.sub(
        r"^```[a-zA-Z]*\n", "", response.text.strip(), flags=re.MULTILINE
    )
    cleaned_code = re.sub(r"\n```$", "", cleaned_code, flags=re.MULTILINE)

    with open(target_file, "w", encoding="utf-8") as f:
        f.write(cleaned_code)
    print(f"Successfully updated {target_file}")
