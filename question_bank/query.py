"""Search the SQLite question bank without external dependencies."""
import argparse
import sqlite3
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chapter', type=int, choices=(1, 2, 3))
    parser.add_argument('--search', default='', help='Vietnamese substring; accent-sensitive')
    parser.add_argument('--id', help='Show a question, options and source answer')
    parser.add_argument('--has-answer', action='store_true')
    parser.add_argument('--quiz-ready', action='store_true', help='Only eligible single-answer questions')
    parser.add_argument('--limit', type=int, default=20)
    args = parser.parse_args()
    db = Path(__file__).resolve().parent / 'questions.sqlite3'
    if not db.exists():
        parser.error('Database missing; run import_word.py first')
    with sqlite3.connect(db.as_uri() + '?mode=ro', uri=True) as conn:
        conn.row_factory = sqlite3.Row
        if args.id:
            rows = conn.execute('SELECT * FROM question_catalog WHERE id=?', (args.id,)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM question_catalog WHERE status!='incomplete' ORDER BY chapter, id").fetchall()
            rows = [r for r in rows if (args.chapter is None or r['chapter'] == args.chapter)
                    and args.search.casefold() in r['question'].casefold()
                    and (not args.has_answer or r['answer_labels'])
                    and (not args.quiz_ready or r['eligible_for_single_answer_quiz'])][:max(0, args.limit)]
        for row in rows:
            print(f"{row['id']} | Chương {row['chapter']} | {row['question']}")
            if args.id:
                for o in conn.execute('SELECT label,text FROM options WHERE question_id=? ORDER BY position', (row['id'],)):
                    print(f"  {o['label']}. {o['text']}")
                print(f"  Đáp án: {row['answer_labels'] or 'Chưa chốt'}")
                print(f"  Xuất xứ đáp án: {row['answer_origin'] or 'Chưa có'}; đã rà soát: {bool(row['answer_verified'])}")
                if row['explanation']:
                    print(f"  Giải thích: {row['explanation']}")
                if row['status'] == 'needs_review':
                    print('  Trạng thái: Cần sửa / xác nhận đề trước khi chấm một đáp án.')
                print(f"  Nguồn: {row['source_filename']}, câu {row['source_number']}")
        if not rows:
            print('Không tìm thấy câu hỏi.')


if __name__ == '__main__':
    main()
