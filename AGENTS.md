# Quy tắc AI Agent

Đọc `PROJECT_CONTEXT.md`, `docs/ARCHITECTURE.md`, prompt liên quan và code trước khi sửa. Bản context tại gốc và `docs/PROJECT_CONTEXT.md` phải giống byte-for-byte. Tài liệu/thông báo tiếng Việt; code tiếng Anh.

- Ưu tiên core login → pair → heartbeat → web giám sát; chưa mở rộng automation khi không được yêu cầu.
- Giữ Next.js/Express/PostgreSQL/Prisma, Node.js 24 và Agent native Windows. Source `remote-control-agent-core-base/` chỉ tham khảo.
- Kiểm tra owner/member tại backend; global OWNER không bypass quyền device. Session user và bearer device riêng.
- Agent outbound; không shell/eval, chạy file tải về hoặc mở inbound. Không log password/code/token/cookie.
- Không sửa `.env` thật, DB/shared bucket hoặc dữ liệu ngoài task; không reset DB, deploy VPS hay publish nếu chưa được yêu cầu.
- Thay DB bằng migration, thay payload qua `packages/contracts`; cập nhật env mẫu/guide khi đổi cấu hình. Quyết định kiến trúc mới ghi ADR.
- Không thêm dependency/hạ tầng hoặc viết test cho sửa tài liệu đơn giản; sửa logic cần kiểm tra đúng rủi ro.

## Vòng đời công việc

1. Chọn/tạo prompt có dependencies đạt trong `docs/promt/`, chuyển nguyên file vào `docs/processing/`.
2. Nêu phạm vi và cách kiểm tra ngắn, rồi thực hiện.
3. Chạy `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`; kiểm tra runtime khi thay kết nối/auth/DB. Dùng DB test biệt lập.
4. Ghi kết quả thực, giới hạn và checklist; chỉ chuyển sang `docs/completed/` khi acceptance đạt. Gate chưa đạt giữ PARTIAL trong processing.
5. Append `docs/IMPLEMENTATION_LOG.md`, commit riêng nếu Git identity có sẵn. Không sửa lịch sử hoặc ghi PASS cho kiểm tra chưa chạy.

Hướng dẫn máy mới: [start-here](docs/guides/start-here.md). Quy trình tài liệu: [CONTEXT_RULES](docs/CONTEXT_RULES.md). Prompt 005 vẫn PARTIAL do gate Windows 11; không coi test Windows 10 là thay thế.
