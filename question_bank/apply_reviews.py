"""Apply the curated answer overlay and synchronize SQLite, JSON and reports."""
import json
import sqlite3
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent


def apply_reviews():
    overlay = json.loads((HERE / 'answer_reviews.json').read_text(encoding='utf-8'))
    data = json.loads((HERE / 'questions.json').read_text(encoding='utf-8'))
    questions = {q['id']: q for q in data['questions']}
    confirmation_path = HERE / 'source_answer_confirmation.json'
    confirmation = json.loads(confirmation_path.read_text(encoding='utf-8')) if confirmation_path.exists() else None
    explanations_path = HERE / 'explanations.json'
    explanations = json.loads(explanations_path.read_text(encoding='utf-8'))['items'] if explanations_path.exists() else []
    assert len(explanations) == len({item['question_id'] for item in explanations})
    assert len(overlay['reviews']) == len({r['question_id'] for r in overlay['reviews']})
    dump = lambda x: json.dumps(x, ensure_ascii=False)
    with sqlite3.connect(HERE / 'questions.sqlite3') as conn:
        conn.execute('PRAGMA foreign_keys=ON')
        if confirmation:
            for qid in confirmation['question_ids']:
                q = questions[qid]
                assert q['answer_origin'] in ('explicit_in_source', 'bold_in_source') and q['answer_labels']
                q['answer_verified'] = True
                q['answer_verification'] = {'method': 'user_confirmed_source', 'date': confirmation['date']}
                conn.execute('UPDATE questions SET answer_verified=1 WHERE id=?', (qid,))
            conn.execute("INSERT OR REPLACE INTO metadata VALUES ('source_answer_confirmation',?)", (dump(confirmation),))
        conn.execute('''CREATE TABLE IF NOT EXISTS answer_reviews (
            question_id TEXT PRIMARY KEY REFERENCES questions(id),
            review_status TEXT NOT NULL, explanation TEXT NOT NULL,
            reference_ids_json TEXT NOT NULL, method TEXT NOT NULL, review_date TEXT NOT NULL
        )''')
        conn.execute('''CREATE TABLE IF NOT EXISTS answer_references (
            id TEXT PRIMARY KEY, title TEXT NOT NULL, url TEXT NOT NULL
        )''')
        conn.execute('''CREATE TABLE IF NOT EXISTS question_explanations (
            question_id TEXT PRIMARY KEY REFERENCES questions(id), explanation TEXT NOT NULL
        )''')
        for rid, ref in overlay['references'].items():
            conn.execute('INSERT OR REPLACE INTO answer_references VALUES (?,?,?)',
                         (rid, ref['title'], ref['url']))
        for review in overlay['reviews']:
            q = questions[review['question_id']]
            assert q['question'], 'Cannot answer an empty question'
            old = conn.execute('SELECT answer_origin FROM questions WHERE id=?', (q['id'],)).fetchone()
            assert old is not None
            if old[0] not in (None, 'researched_solution'):
                raise ValueError('Refusing to replace an original source answer: ' + q['id'])
            assert set(review['answer_labels']) <= {o['label'] for o in q['options']}
            assert set(review['reference_ids']) <= overlay['references'].keys()
            q['answer_labels'] = review['answer_labels']
            q['answer_origin'] = 'researched_solution' if review['answer_labels'] else None
            # Verified means the theory and solution were checked, not teacher approval.
            q['answer_verified'] = bool(review['answer_labels'])
            q['review'] = {**review, 'review_date': overlay['review_date']}
            q['issues'] = [i for i in q['issues'] if i not in (
                'missing_answer', 'ambiguous_or_invalid_question', 'multiple_correct_options')]
            if not review['answer_labels']:
                q['issues'] += ['missing_answer', 'ambiguous_or_invalid_question']
            if review['review_status'] == 'multiple_correct_options':
                q['issues'].append('multiple_correct_options')
            q['status'] = 'reviewed' if review['review_status'] == 'resolved' else 'needs_review'
            conn.execute('DELETE FROM answers WHERE question_id=?', (q['id'],))
            for label in q['answer_labels']:
                conn.execute('INSERT INTO answers VALUES (?,?)', (q['id'], label))
            conn.execute('''UPDATE questions SET answer_origin=?,answer_verified=?,status=?,issues_json=? WHERE id=?''',
                         (q['answer_origin'], q['answer_verified'], q['status'], dump(q['issues']), q['id']))
            conn.execute('INSERT OR REPLACE INTO answer_reviews VALUES (?,?,?,?,?,?)',
                         (q['id'], review['review_status'], review['explanation'], dump(review['reference_ids']),
                          review['method'], overlay['review_date']))
        for item in explanations:
            q = questions[item['question_id']]
            assert item['explanation'].strip() and q['question']
            q['explanation'] = item['explanation']
            conn.execute('INSERT OR REPLACE INTO question_explanations VALUES (?,?)',
                         (q['id'], item['explanation']))
        conn.execute("INSERT OR REPLACE INTO metadata VALUES ('schema_version','3')")
        conn.execute("INSERT OR REPLACE INTO metadata VALUES ('answer_policy',?)", (overlay['policy'],))
        conn.execute('DROP VIEW question_catalog')
        conn.execute('''CREATE VIEW question_catalog AS
            SELECT q.id,q.chapter,q.section,q.question,s.filename AS source_filename,
                q.source_number,q.status,q.answer_origin,q.answer_verified,
                (SELECT group_concat(label, ',') FROM answers a WHERE a.question_id=q.id) AS answer_labels,
                r.review_status,COALESCE(e.explanation,r.explanation) AS explanation,
                CASE WHEN q.status IN ('incomplete','needs_review') THEN 0
                     WHEN q.issues_json LIKE '%duplicate_option_text%' THEN 0
                     WHEN (SELECT count(*) FROM answers a WHERE a.question_id=q.id)=1 THEN 1 ELSE 0 END
                     AS eligible_for_single_answer_quiz
            FROM questions q JOIN sources s ON s.id=q.source_id
            LEFT JOIN answer_reviews r ON r.question_id=q.id
            LEFT JOIN question_explanations e ON e.question_id=q.id''')
        assert conn.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
        assert not conn.execute('PRAGMA foreign_key_check').fetchall()
    data['schema_version'] = 3
    data['answer_references'] = overlay['references']
    if confirmation:
        data['source_answer_confirmation'] = confirmation
    (HERE / 'questions.json').write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    counts = Counter(r['review_status'] for r in overlay['reviews'])
    stats = {
        'review_date': overlay['review_date'], 'reviewed_previously_unanswered': len(overlay['reviews']),
        'review_outcomes': dict(counts),
        'total_nonempty_questions': sum(bool(q['question']) for q in questions.values()),
        'total_questions_with_answers': sum(bool(q['answer_labels']) for q in questions.values()),
        'nonempty_questions_without_answers': sum(bool(q['question']) and not q['answer_labels'] for q in questions.values()),
        'empty_placeholders': sum(not q['question'] for q in questions.values()),
        'user_confirmed_source_answers': len(confirmation['question_ids']) if confirmation else 0,
        'questions_with_supplemental_explanations': len(explanations),
    }
    (HERE / 'answer_review_summary.json').write_text(json.dumps(stats, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    source_names = {s['id']: s['filename'] for s in data['sources']}
    lines = ['# Kết quả bổ sung đáp án', '',
             'Đối chiếu lý thuyết và giải lại 96 câu ban đầu chưa có đáp án. Đây là kết quả phân tích, không phải đáp án chính thức của giảng viên.', '',
             f"- {counts['resolved']} câu đã chọn được một đáp án.",
             f"- {counts['multiple_correct_options']} câu có nhiều lựa chọn đúng, cần sửa dạng đề trước khi chấm một đáp án.",
             f"- {counts['needs_review']} câu thiếu phương án đúng hoặc còn mơ hồ, chưa gán đáp án để chấm tự động.",
             ('- 115 đáp án có sẵn hoặc bôi đậm trong Word được người dùng xác nhận là đúng.' if confirmation else '- 115 đáp án có sẵn được giữ nguyên và chưa nằm trong phạm vi kiểm chứng lần này.'), '',
             'Các chữ A–D theo thứ tự lựa chọn trong ngân hàng dữ liệu. Các nguồn dẫn là cơ sở lý thuyết để giải, không phải bảng đáp án của đề.', '']
    for sid in dict.fromkeys(questions[r['question_id']]['source_id'] for r in overlay['reviews']):
        lines += ['## ' + source_names[sid], '', '| Câu gốc | Đáp án | Kết luận / giải thích | Nguồn lý thuyết |', '|---|---|---|---|']
        for r in overlay['reviews']:
            q = questions[r['question_id']]
            if q['source_id'] != sid:
                continue
            labels = ', '.join(r['answer_labels']) or 'Cần sửa / xác nhận đề'
            if r['review_status'] == 'multiple_correct_options':
                labels += ' (nhiều đáp án)'
            links = ', '.join(f"[{rid}]({overlay['references'][rid]['url']})" for rid in r['reference_ids'])
            lines.append(f"| {q['source_number']} | {labels} | {r['explanation'].replace('|','/')} | {links} |")
        lines.append('')
    lines += ['## Tài liệu tham khảo', '']
    for rid, ref in overlay['references'].items():
        lines.append(f"- [{rid}: {ref['title']}]({ref['url']})")
    lines += ['', 'Nội dung Word, thứ tự lựa chọn và các đoạn gốc được giữ nguyên. Dùng `eligible_for_single_answer_quiz = 1` trong `question_catalog` để loại các mục chưa phù hợp với chấm một đáp án, gồm câu có lựa chọn trùng nội dung. `answer_origin` phân biệt đáp án từ Word với lời giải bổ sung; xác nhận của người dùng về đáp án Word được lưu trong `source_answer_confirmation.json`.', '']
    (HERE / 'ANSWER_REVIEW.md').write_text('\n'.join(lines), encoding='utf-8')
    print(json.dumps(stats, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    apply_reviews()
