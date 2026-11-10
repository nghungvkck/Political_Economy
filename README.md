# Luyện đề Kinh tế chính trị

Trang web trắc nghiệm Kinh tế chính trị Mác – Lênin. Tạo đề ngẫu nhiên 50 câu, chọn đáp án, nộp bài để xem điểm và kiểm tra từng câu. Website dùng HTML, CSS và JavaScript thuần, chạy trực tiếp trên trình duyệt và có thể đăng lên GitHub Pages.

## Tính năng

- Tạo đề 50 câu theo đúng tỷ lệ các chương, không lặp câu trong một đề.
- Chọn một đáp án cho mỗi câu, có thể đổi lựa chọn trước khi nộp.
- Chuyển câu bằng nút trước / tiếp hoặc bảng số câu hỏi.
- Hiển thị tiến độ và xác nhận trước khi nộp bài.
- Chấm điểm trên thang 10, thống kê kết quả theo chương.
- Xem câu đúng, câu sai, câu bỏ trống, đáp án đúng và giải thích nếu có.
- Lọc bài làm theo trạng thái đúng / sai / chưa trả lời.
- Bấm **Làm lại** để tạo đề mới.
- Tự lưu bài làm trên trình duyệt hiện tại bằng `localStorage`.
- Giao diện hỗ trợ máy tính và điện thoại; không giới hạn thời gian làm bài.

## Cấu trúc đề

| Nội dung | Số câu | Tỷ lệ |
|---|---:|---:|
| Chương 1 | 10 | 20% |
| Chương 2 | 20 | 40% |
| Chương 3 | 20 | 40% |
| **Tổng** | **50** | **100%** |

Mỗi câu đúng được **0,2 điểm**; câu sai hoặc bỏ trống được 0 điểm. Điểm tối đa là 10.

Ngân hàng dành cho trang web hiện có **198 câu**: 10 câu chương 1, 78 câu chương 2 và 110 câu chương 3. Vì chương 1 có đúng 10 câu nên mỗi đề dùng đủ 10 câu này. Câu chương 2 và 3 được chọn ngẫu nhiên; thứ tự 50 câu được đảo, thứ tự lựa chọn A–D được giữ nguyên.

## Chạy trên máy

Mở file [index.html](index.html) bằng trình duyệt, hoặc mở terminal tại **thư mục gốc dự án** rồi chạy:

```bash
python -m http.server 8000
```

Truy cập **http://localhost:8000**. Nếu máy dùng lệnh `python3`, thay `python` bằng `python3`.

Không cần cài thư viện hoặc chạy bước build. Trang web chỉ cần `index.html` và thư mục `assets/`.

## Đăng lên GitHub Pages

1. Tạo repository GitHub và đưa nội dung dự án lên nhánh `main`. Đảm bảo `index.html` nằm ngay ở thư mục gốc repository, cùng cấp với `assets/`.
2. Mở repository, vào **Settings → Pages**.
3. Trong **Build and deployment**, chọn **Source: Deploy from a branch**.
4. Chọn **Branch: main**, thư mục **/(root)**, rồi bấm **Save**.
5. Khi triển khai hoàn tất, mở đường dẫn được GitHub hiển thị trong trang Pages.

Ví dụ địa chỉ một project site: `https://<ten-tai-khoan>.github.io/<ten-repository>/`.

Các đường dẫn tài nguyên là đường dẫn tương đối để website chạy được dưới tên repository. File `.nojekyll` đi kèm để phục vụ website tĩnh. Xem [hướng dẫn cấu hình nguồn GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

Nếu chỉ đăng website, bộ file cần đưa lên là:

```text
index.html
assets/
.nojekyll
README.md
```

Các thư mục tài liệu Word, SQLite và công cụ Python không cần thiết khi chạy website.

## Cấu trúc dự án

```text
.
├── index.html                 # Trang chính, sẵn sàng cho GitHub Pages
├── assets/
│   ├── styles.css             # Giao diện
│   ├── app.js                 # Chọn đáp án, điều hướng và kết quả
│   ├── core.js                # Tạo đề, chấm điểm và kiểm tra bài lưu
│   ├── bank.js                # 198 câu được xuất cho website
│   └── icon.svg               # Biểu tượng trang
├── data/                      # Các file Word gốc
├── question_bank/             # SQLite, JSON, đáp án và báo cáo rà soát
├── quiz_web/
│   ├── export_bank.py         # Xuất SQLite sang assets/bank.js
│   └── core.test.cjs          # Kiểm tra chức năng
├── .nojekyll
└── README.md
```

## Cập nhật câu hỏi

Cơ sở dữ liệu chính là `question_bank/questions.sqlite3`. Website dùng bản xuất `assets/bank.js`; không đọc SQLite trực tiếp.

Sau khi cập nhật SQLite, chạy từ thư mục gốc:

```bash
python quiz_web/export_bank.py
node quiz_web/core.test.cjs
```

Sau đó đưa bản `assets/bank.js` mới lên GitHub. Chương trình chỉ xuất các câu đủ điều kiện cho đề một đáp án, loại câu thiếu đáp án, nhiều đáp án hoặc có lựa chọn trùng nội dung.

Các đáp án có sẵn / bôi đậm trong Word được người dùng xác nhận là đúng. Các lời giải bổ sung và câu cần rà soát được lưu trong [báo cáo đáp án](question_bank/ANSWER_REVIEW.md). Xem [hướng dẫn ngân hàng câu hỏi](question_bank/README.md) để biết cách nhập lại tài liệu và quản lý dữ liệu.

## Lưu bài làm

Bài làm được lưu trên trình duyệt và thiết bị đang dùng, không gửi đến máy chủ. Tải lại trang sẽ tiếp tục bài đang làm hoặc hiển thị lại kết quả đã nộp. Bấm **Làm lại** sẽ tạo đề mới và thay bài đang lưu.

Khi phiên bản ngân hàng câu hỏi thay đổi, bài lưu từ phiên bản cũ sẽ được bỏ qua để tránh chấm sai dữ liệu. Nếu trình duyệt không cho phép lưu, trang vẫn hoạt động trong tab hiện tại.

## Kiểm tra chức năng

Cần Node.js để chạy kiểm tra; người làm bài không cần cài Node.js.

```bash
node quiz_web/core.test.cjs
```

Các kiểm tra bao gồm: sinh 500 đề đúng tỷ lệ 10–20–20 và không trùng câu trong cùng đề; dữ liệu một đáp án; chấm câu đúng / sai / bỏ trống; phục hồi bài lưu; luồng chọn, đổi đáp án, nộp, lọc kết quả và tạo đề mới.
