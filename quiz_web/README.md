# Công cụ cho trang luyện đề

Trang web hiện nằm ở `../index.html`, các file giao diện và dữ liệu nằm trong `../assets/`.

Xem [README dự án](../README.md) để chạy thử và đăng GitHub Pages.

Chạy các lệnh sau từ thư mục gốc dự án:

```bash
python quiz_web/export_bank.py
node quiz_web/core.test.cjs
```

`export_bank.py` xuất các câu đủ điều kiện làm đề một đáp án từ `question_bank/questions.sqlite3` sang `assets/bank.js`.

`core.test.cjs` kiểm tra tỷ lệ câu hỏi, tránh trùng câu, chấm điểm, lưu bài và luồng làm lại.
