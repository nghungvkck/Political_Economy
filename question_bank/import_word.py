"""Import the original Word question sets using only Python's standard library."""
import argparse
import hashlib
import json
import re
import sqlite3
import unicodedata
import zipfile
from collections import Counter
from pathlib import Path
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
W = "{" + NS["w"] + "}"
QUESTION = re.compile(r"^(?:Câu\s*)?(\d+)\s*[:：]\s*(.*)$", re.I)
ANSWER = re.compile(r"^Đáp\s*án\s*:?\s*([a-d])\b", re.I)
LABEL = re.compile(r"(?:^|(?<=\s)|(?<=£)|(?<=%))([a-d])[.)]\s*", re.I)


def clean(s):
    return unicodedata.normalize("NFC", s).replace("\xa0", " ").strip()


def paragraphs(path):
    with zipfile.ZipFile(path) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
    result = []
    for p in root.findall(".//w:p", NS):
        pieces = []
        for run in p.findall(".//w:r", NS):
            text = "".join(n.text or "" for n in run.findall(".//w:t", NS))
            bold = run.find("w:rPr/w:b", NS)
            is_bold = bold is not None and bold.get(W + "val", "true") not in ("0", "false", "off")
            pieces.append({"text": text, "bold": is_bold})
        text = clean("".join(p["text"] for p in pieces))
        if text:
            result.append({"text": text, "runs": pieces})
    return result


def split_options(paragraph):
    text = paragraph["text"]
    matches = list(LABEL.finditer(text))
    # Several answers in these files are packed into one paragraph.
    if matches and (matches[0].start() == 0 or len(matches) >= 2):
        chunks = []
        if matches[0].start() > 0:
            chunks.append((None, text[:matches[0].start()]))
        chunks.extend((m[1].upper(), text[m.end():matches[i+1].start() if i+1 < len(matches) else len(text)])
                      for i, m in enumerate(matches))
    else:
        chunks = [(None, text)]
    # Only infer from bold when substantially all meaningful option text is bold.
    total = sum(len(re.sub(r"\W", "", r["text"])) for r in paragraph["runs"])
    bold = sum(len(re.sub(r"\W", "", r["text"])) for r in paragraph["runs"] if r["bold"])
    return [(label, clean(t), bool(total and bold / total >= .9 and len(chunks) == 1))
            for label, t in chunks]


def parse(source_id, path):
    ps = paragraphs(path)
    chapter_match = re.search(r"(?:chuong|chương)\s*(\d+)", clean(path.name), re.I)
    chapter = int(chapter_match[1]) if chapter_match else None
    questions, current, section = [], None, None
    for index, p in enumerate(ps, 1):
        text = p["text"]
        if text.casefold() in ("mức độ dễ", "mức độ trung bình", "mức độ khó"):
            section = text
            continue
        if "đáp án mỗi câu" in text.lower():
            continue
        match = QUESTION.match(text)
        if match:
            current = {
                "id": f"{source_id}-q{len(questions)+1:03d}", "source_id": source_id,
                "source_number": int(match[1]), "source_paragraph": index,
                "chapter": chapter, "section": section, "question": clean(match[2]),
                "options": [], "answer_labels": [], "answer_origin": None,
                "answer_verified": False, "issues": [], "raw_paragraphs": [p],
            }
            questions.append(current)
            continue
        if current is None:
            continue
        current["raw_paragraphs"].append(p)
        answer = ANSWER.match(text)
        if answer:
            current["answer_labels"].append(answer[1].upper())
            current["answer_origin"] = "explicit_in_source"
            continue
        if not current["options"] and text == "kinh tế sau đây?" and current["question"].endswith("các quy luật"):
            current["question"] += " " + text
            continue
        for label, option, bold in split_options(p):
            label = label or chr(65 + len(current["options"]))
            current["options"].append({"label": label, "text": option, "bold_in_source": bold})
    for q in questions:
        if not q["answer_labels"] and path.name == "Chuong2_2.docx":
            q["answer_labels"] = [o["label"] for o in q["options"] if o["bold_in_source"]]
            if q["answer_labels"]:
                q["answer_origin"] = "bold_in_source"
        q["answer_labels"] = sorted(set(q["answer_labels"]))
        if not q["question"]:
            q["issues"].append("empty_question")
        if len(q["options"]) != 4:
            q["issues"].append("option_count_not_four")
        if len({o["label"] for o in q["options"]}) != len(q["options"]):
            q["issues"].append("duplicate_option_labels")
        if len({o["text"] for o in q["options"]}) != len(q["options"]):
            q["issues"].append("duplicate_option_text")
        if not q["answer_labels"]:
            q["issues"].append("missing_answer")
        if any(a not in {o["label"] for o in q["options"]} for a in q["answer_labels"]):
            q["issues"].append("answer_option_missing")
        q["status"] = "incomplete" if not q["question"] or len(q["options"]) != 4 else "imported"
    return ps, questions


SCHEMA = """
PRAGMA foreign_keys=ON;
CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE sources (
 id TEXT PRIMARY KEY, filename TEXT NOT NULL, relative_path TEXT NOT NULL,
 sha256 TEXT NOT NULL, paragraphs_json TEXT NOT NULL
);
CREATE TABLE questions (
 id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES sources(id),
 source_number INTEGER NOT NULL, source_paragraph INTEGER NOT NULL,
 chapter INTEGER, section TEXT, question TEXT NOT NULL,
 answer_origin TEXT, answer_verified INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL, issues_json TEXT NOT NULL, raw_paragraphs_json TEXT NOT NULL
);
CREATE TABLE options (
 question_id TEXT NOT NULL REFERENCES questions(id), position INTEGER NOT NULL,
 label TEXT NOT NULL, text TEXT NOT NULL, bold_in_source INTEGER NOT NULL,
 PRIMARY KEY (question_id, position), UNIQUE(question_id, label)
);
CREATE TABLE answers (
 question_id TEXT NOT NULL, label TEXT NOT NULL,
 PRIMARY KEY (question_id, label),
 FOREIGN KEY (question_id, label) REFERENCES options(question_id, label)
);
CREATE INDEX questions_chapter ON questions(chapter);
CREATE INDEX questions_source ON questions(source_id);
CREATE VIEW question_catalog AS
 SELECT q.id, q.chapter, q.section, q.question, s.filename AS source_filename,
 q.source_number, q.status, q.answer_origin, q.answer_verified,
 (SELECT group_concat(label, ',') FROM answers a WHERE a.question_id=q.id) AS answer_labels
 FROM questions q JOIN sources s ON s.id=q.source_id;
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=HERE.parent / "data")
    parser.add_argument("--rebuild", action="store_true", help="Replace existing exports with the Word originals")
    args = parser.parse_args()
    db = HERE / "questions.sqlite3"
    if db.exists() and not args.rebuild:
        parser.error("Database exists. Use --rebuild only to discard edits and reimport the originals.")
    sources, questions = [], []
    for path in sorted(args.source.glob("*.docx"), key=lambda p: clean(p.name)):
        # IDs depend on the original filename, not its position in the file list.
        sid = "src-" + hashlib.sha256(clean(path.name).encode()).hexdigest()[:12]
        ps, qs = parse(sid, path)
        sources.append({"id": sid, "filename": path.name, "relative_path": "../data/" + path.name,
                        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "paragraphs": ps})
        questions.extend(qs)
    if not sources:
        parser.error("No .docx files found")
    by_stem = {}
    for q in questions:
        key = re.sub(r"\W+", "", q["question"].casefold())
        if key:
            by_stem.setdefault(key, []).append(q["id"])
    duplicates = [ids for ids in by_stem.values() if len(ids) > 1]
    stats = {
        "sources": len(sources), "records": len(questions),
        "nonempty_questions": sum(bool(q["question"]) for q in questions),
        "with_source_answer": sum(bool(q["answer_labels"]) for q in questions),
        "without_source_answer": sum(not q["answer_labels"] for q in questions),
        "by_chapter": dict(Counter(str(q["chapter"]) for q in questions)),
        "issues": dict(Counter(issue for q in questions for issue in q["issues"])),
    }
    dump = lambda value: json.dumps(value, ensure_ascii=False)
    temporary = HERE / "questions.build.sqlite3"
    if temporary.exists():
        temporary.unlink()
    with sqlite3.connect(temporary) as conn:
        conn.executescript(SCHEMA)
        conn.execute("INSERT INTO metadata VALUES (?,?)", ("schema_version", "1"))
        conn.execute("INSERT INTO metadata VALUES (?,?)", ("answer_policy", "Imported from source; not academically verified"))
        for s in sources:
            conn.execute("INSERT INTO sources VALUES (?,?,?,?,?)", (s["id"], s["filename"], s["relative_path"], s["sha256"], dump(s["paragraphs"])))
        for q in questions:
            conn.execute("INSERT INTO questions VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", (
                q["id"], q["source_id"], q["source_number"], q["source_paragraph"], q["chapter"], q["section"],
                q["question"], q["answer_origin"], 0, q["status"], dump(q["issues"]), dump(q["raw_paragraphs"])))
            for pos, o in enumerate(q["options"], 1):
                conn.execute("INSERT INTO options VALUES (?,?,?,?,?)", (q["id"], pos, o["label"], o["text"], o["bold_in_source"]))
            for label in q["answer_labels"]:
                conn.execute("INSERT INTO answers VALUES (?,?)", (q["id"], label))
        assert conn.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
        assert not conn.execute("PRAGMA foreign_key_check").fetchall()
    temporary.replace(db)
    export = {"schema_version": 1, "sources": [{k:v for k,v in s.items() if k != "paragraphs"} for s in sources], "questions": questions}
    (HERE / "questions.json").write_text(json.dumps(export, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report = {"statistics": stats, "by_source": {s["filename"]: sum(q["source_id"] == s["id"] for q in questions) for s in sources},
              "identical_question_stem_groups": duplicates,
              "records_to_review": [{"id": q["id"], "issues": q["issues"]} for q in questions if q["issues"]]}
    (HERE / "import_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["statistics"], ensure_ascii=False, indent=2))
    if (HERE / 'answer_reviews.json').exists():
        from apply_reviews import apply_reviews
        apply_reviews()


if __name__ == "__main__":
    main()
