"""Export only single-answer questions from the canonical SQLite database."""
import hashlib
import json
import sqlite3
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / 'question_bank' / 'questions.sqlite3'
with sqlite3.connect(SOURCE) as db:
    db.row_factory = sqlite3.Row
    rows = db.execute('''SELECT * FROM question_catalog
        WHERE eligible_for_single_answer_quiz=1 ORDER BY id''').fetchall()
    questions = []
    for row in rows:
        options = [dict(o) for o in db.execute(
            'SELECT label,text FROM options WHERE question_id=? ORDER BY position', (row['id'],))]
        assert len(options) == 4 and row['answer_labels'] in 'ABCD'
        questions.append({'id': row['id'], 'chapter': row['chapter'], 'text': row['question'],
                          'options': options, 'answer': row['answer_labels'],
                          'explanation': row['explanation'] or ''})
serialized = json.dumps([{k:v for k,v in q.items() if k != 'explanation'} for q in questions],
                        ensure_ascii=False, separators=(',', ':'))
payload = {'version': hashlib.sha256(serialized.encode()).hexdigest()[:16], 'questions': questions}
output = HERE.parent / 'assets' / 'bank.js'
if output.exists():
    try:
        previous = json.loads(output.read_text(encoding='utf-8').strip().removeprefix('window.QUIZ_BANK = ').removesuffix(';'))
        previous_content = [{k:v for k,v in q.items() if k != 'explanation'} for q in previous['questions']]
        if previous_content == [{k:v for k,v in q.items() if k != 'explanation'} for q in questions]:
            payload['version'] = previous['version']
    except (ValueError, KeyError, TypeError):
        pass
output.parent.mkdir(exist_ok=True)
output.write_text('window.QUIZ_BANK = ' + json.dumps(payload, ensure_ascii=False) + ';\n', encoding='utf-8')
print(f'Exported {len(questions)} questions: ' + ', '.join(
    f'chapter {c}: {sum(q["chapter"] == c for q in questions)}' for c in (1, 2, 3)))
