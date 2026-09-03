"""Read-only verification of the reviewed FAQ transcription. Requires pypdf."""
import hashlib
import json
import re
from pathlib import Path

from pypdf import PdfReader

root = Path(__file__).resolve().parents[1]
source = root / "FAQs.pdf"
data = json.loads((root / "prisma/data/faq.json").read_text())
if not source.is_file():
    raise SystemExit("FAQs.pdf is missing; content cannot be verified.")
if hashlib.sha256(source.read_bytes()).hexdigest() != data["source"]["sha256"]:
    raise SystemExit("Source PDF changed. Review and reconcile every question before updating the import.")


def normalize(text):
    return re.sub(r"\s+", "", text)


text = normalize(" ".join(page.extract_text() for page in PdfReader(source).pages))
checked = 0
for topic in data["topics"]:
    for item in topic["items"]:
        if normalize(item["question"]) not in text:
            raise SystemExit(f"Question not found in source: {topic['slug']}/{item['slug']}")
        for block in item["answer"]["blocks"]:
            runs = [block["content"]] if block["type"] == "paragraph" else block["items"]
            for run in runs:
                if normalize("".join(span["text"] for span in run)) not in text:
                    raise SystemExit(f"Answer differs from source: {topic['slug']}/{item['slug']}")
        checked += 1
print(f"Source SHA-256 and all text verified: {len(data['topics'])} topics, {checked} questions.")
