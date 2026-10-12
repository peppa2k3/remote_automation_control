# Context rules và vòng đời prompt

## Thứ tự đọc

1. Yêu cầu mới nhất của chủ dự án.
2. `AGENTS.md` và `docs/PROJECT_CONTEXT.md`.
3. `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/API.md` và README.
4. Prompt cụ thể và các module/test liên quan.

Yêu cầu trực tiếp mới nhất được ưu tiên. Nếu khác baseline kiến trúc, ghi ADR và cập nhật tài liệu liên quan; không suy đoán rằng thiếu cấu hình là lý do thay stack.

## Nguồn ngữ cảnh

`PROJECT_CONTEXT.md` nguyên bản được giữ tại gốc cho IDE. `docs/PROJECT_CONTEXT.md` là bản sao phục vụ quy trình agent. Khi thay đặc tả, sửa bản gốc rồi đồng bộ bản docs trong cùng thay đổi. `pnpm docs:check` kiểm tra hai bản giống nhau.

`docs/ARCHITECTURE.md` phân biệt rõ thiết kế mục tiêu và phần đã triển khai. README mô tả cách chạy hiện tại. `docs/IMPLEMENTATION_LOG.md` là lịch sử append-only sau mỗi prompt. Không sửa lịch sử để giả lập task đã thành công.

## Thư mục theo yêu cầu chủ dự án

| Thư mục | Ý nghĩa |
|---|---|
| `docs/promt/` | Prompt chờ, trạng thái PLANNED |
| `docs/processing/` | Đang làm hoặc PARTIAL/BLOCKED |
| `docs/completed/` | Đã đạt toàn bộ acceptance gate, DONE |

Giữ chính tả `promt` theo yêu cầu hiện tại; thay thế quy ước `docs/prompts/planned` trong baseline. Mỗi ID chỉ có đúng một file ở một trong ba thư mục, tên `001-short-name.md`. Không sao chép prompt để đổi trạng thái.

## Thông tin mỗi prompt

Front matter có `id`, `title`, `status`, `depends_on`, `baseline_task`. Nội dung gồm mục tiêu, phạm vi, đầu vào/đầu ra, business rules, bảo mật, acceptance checklist, kế hoạch kiểm tra và kết quả thực hiện. Dependency phải hoàn thành trước khi bắt đầu; Meta spike được lên lịch sớm sau auth và không chặn phần download.

Hoàn thành: cập nhật checklist và kết quả → chuyển file → append log → commit riêng. SHA cuối cùng được ghi ở log trong thay đổi tiếp theo hoặc dùng commit subject duy nhất trong prompt. Không dùng placeholder SHA như bằng chứng đã commit.

## Phạm vi đợt khởi tạo

Prompt 001 phân tích và tài liệu; 002 bootstrap T00; 003 database/health T01. Các prompt 004–020 giữ trong backlog để tiếp tục từng tính năng. Chỉ bắt đầu chức năng nghiệp vụ khi nền tảng đã chạy và kiểm thử được.
