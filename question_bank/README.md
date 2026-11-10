# Ngân hàng câu hỏi Kinh tế chính trị

Thư mục này là nguồn dữ liệu câu hỏi để dùng cho việc ôn tập, tạo đề hoặc xây dựng ứng dụng sau này. Dữ liệu được nhập từ 6 file Word trong `../data`; không sửa các tài liệu gốc.

## Các file

- `questions.sqlite3`: cơ sở dữ liệu SQLite chính, không cần cài máy chủ.
- `questions.json`: bản xuất UTF-8 thuận tiện để đọc hoặc nhập vào ứng dụng; chứa câu hỏi, lựa chọn, đáp án, nguồn và các đoạn gốc kèm dấu bôi đậm.
- `import_report.json`: báo cáo lần nhập Word ban đầu, trước khi bổ sung đáp án; không phản ánh số câu thiếu đáp án hiện tại. Các nhóm trùng chỉ là gợi ý, chưa so sánh lựa chọn.
- `ANSWER_REVIEW.md`: kết quả giải 96 câu ban đầu chưa có đáp án, kèm giải thích và nguồn tham khảo.
- `answer_reviews.json`: lớp đáp án bổ sung, được áp dụng lại khi nhập Word.
- `explanations.json`: giải thích cho 198 câu dùng trong đề một đáp án, được áp dụng lại cùng lớp đáp án. Có lưu ý cụ thể với câu phụ thuộc cách quy ước hoặc diễn đạt trong tài liệu.
- `source_answer_confirmation.json`: ghi nhận người dùng xác nhận 115 đáp án trong Word là đúng, được áp dụng lại khi nhập dữ liệu.
- `answer_review_summary.json`: thống kê sau khi bổ sung đáp án.
- `apply_reviews.py`: áp dụng lớp đáp án, đồng bộ SQLite, JSON và báo cáo rà soát.
- `backups/before_answer_review/`: bản sao dữ liệu trước khi bổ sung đáp án.
- `import_word.py`: chương trình nhập lại từ Word, chỉ dùng thư viện chuẩn Python.
- `query.py`: tìm câu hỏi và xem chi tiết từ SQLite.

## Dữ liệu hiện có

Có 212 bản ghi: **211 câu có nội dung** và **1 mục trống** (`Câu 32` ở phần dễ của `Chuong3_Hanh.docx`). Chương 1 có 10 câu, chương 2 có 85 câu, chương 3 có 116 câu có nội dung và 1 mục trống.

Đã rà soát 96 câu ban đầu chưa có đáp án: **84 câu có một đáp án**, **4 câu có nhiều lựa chọn đúng**, **8 câu cần sửa hoặc xác nhận đề**. Hiện có 203 câu có đáp án (gồm 115 câu có sẵn và 88 câu được bổ sung); còn 8 câu có nội dung chưa chốt đáp án và 1 mục trống.

115 đáp án có sẵn hoặc bôi đậm trong Word đã được người dùng xác nhận là đúng ngày 10/11/2026 và được đánh dấu `answer_verified = 1`. 88 đáp án bổ sung được phân tích dựa trên lý thuyết và các phép tính; không phải đáp án chính thức của giảng viên. Xem các điều kiện và lưu ý cho từng câu trong `ANSWER_REVIEW.md`. Có 198 câu dùng được để tạo đề một đáp án sau khi loại câu có lựa chọn trùng nội dung.

- `explicit_in_source`: đáp án ghi bằng dòng “Đáp án” trong Word.
- `bold_in_source`: đáp án lấy từ lựa chọn bôi đậm ở `Chuong2_2.docx`, theo ghi chú trong chính file đó.
- `researched_solution`: đáp án bổ sung sau đối chiếu và giải lại.
- `answer_verified = 0`: chưa kiểm chứng đáp án.
- `answer_verified = 1`: đã được người dùng xác nhận (đáp án Word) hoặc đã rà soát theo lý thuyết (lời giải bổ sung). Xem `answer_origin` để phân biệt.
- `status = reviewed`: câu được bổ sung một đáp án.
- `status = needs_review`: câu có nhiều lựa chọn đúng hoặc đề chưa đủ rõ để chấm tự động.
- `status = incomplete`: mục thiếu nội dung hoặc không có đủ 4 lựa chọn.
- `issues_json`: thông tin cần rà soát, như thiếu đáp án hoặc lựa chọn trùng nhau.

Giữ nguyên các câu trùng giữa các nguồn và thứ tự lựa chọn. Các nhãn A–D được bổ sung theo thứ tự khi Word không có nhãn hiển thị trong nội dung. Câu 36 của `Chuong2_2.docx` bị ngắt câu hỏi sang đoạn tiếp theo; trình nhập đã ghép lại. Những lựa chọn nằm chung một đoạn cũng được tách ra. Mỗi nguồn có mã SHA-256 để đối chiếu file gốc.

## Tra cứu

Chạy từ thư mục dự án:

```bash
python question_bank/query.py --chapter 2 --search 'hàng hóa' --limit 10
python question_bank/query.py --chapter 3 --has-answer --limit 5
python question_bank/query.py --chapter 2 --quiz-ready --limit 10
python question_bank/query.py --id '<mã câu hỏi>'
```

`--has-answer` yêu cầu có đáp án từ nguồn hoặc từ lần rà soát. `--quiz-ready` bỏ các câu nhiều đáp án / chưa chốt, câu có lựa chọn trùng và mục trống. Tra cứu mặc định chỉ bỏ mục trống, vẫn cho phép tìm các câu cần sửa để đọc giải thích.

## Cấu trúc SQLite

| Bảng / view | Nội dung |
|---|---|
| `sources` | Tên file, đường dẫn tương đối với thư mục này, mã kiểm tra và các đoạn Word gốc |
| `questions` | ID, chương, mức độ, câu hỏi, số câu gốc, nguồn, trạng thái và vấn đề cần rà soát |
| `options` | Lựa chọn theo thứ tự, nhãn và nội dung |
| `answers` | Nhãn đáp án từ nguồn hoặc từ lần rà soát; không có dòng nếu chưa biết |
| `answer_reviews` | Kết luận, giải thích, phương pháp và ngày rà soát |
| `answer_references` | Tên và liên kết tài liệu lý thuyết |
| `question_explanations` | Giải thích bổ sung; view `question_catalog` ưu tiên nội dung này khi có |
| `metadata` | Phiên bản cấu trúc và chính sách đáp án |
| `question_catalog` | View để tra cứu câu hỏi kèm tên file nguồn và nhãn đáp án |

ID của câu hỏi kết hợp mã tên nguồn và thứ tự xuất hiện, không dùng riêng số câu trong Word vì có phần đánh số lại từ 1. Nếu sửa tên file hoặc chèn câu vào Word, ID khi nhập lại có thể thay đổi.

Ví dụ chọn ngẫu nhiên 20 câu chương 3 phù hợp với đề một đáp án:

```sql
SELECT * FROM question_catalog
WHERE chapter = 3 AND eligible_for_single_answer_quiz = 1
ORDER BY RANDOM() LIMIT 20;
```

Thêm `AND answer_origin = 'researched_solution'` nếu chỉ lấy câu được giải bổ sung. Khi tạo bộ đề cho người học, ứng dụng cần tải riêng `options` theo `position` và giữ `answers` ở phần chấm điểm.

## Cập nhật

SQLite là dữ liệu chính để phát triển và biên tập sau này. Chỉnh SQLite trực tiếp không tự cập nhật JSON hoặc lớp đáp án. Khi chỉnh kết quả rà soát, sửa `answer_reviews.json` rồi chạy `python question_bank/apply_reviews.py` để đồng bộ. Chương trình này chỉ áp dụng 96 mục được liệt kê, không thay đáp án có sẵn trong Word.

Chỉ nhập lại khi muốn thay toàn bộ cơ sở dữ liệu bằng nội dung Word:

```bash
python question_bank/import_word.py --rebuild
```

Lệnh này ghi đè SQLite, JSON và báo cáo rồi tự áp dụng lại `answer_reviews.json`. Các chỉnh sửa chỉ nằm trong SQLite/JSON sẽ bị mất; hãy sao lưu trước nếu đã biên tập dữ liệu. Chạy không có `--rebuild` sẽ từ chối ghi đè cơ sở dữ liệu hiện có.
