# Nhật ký thực hiện prompt

Mỗi prompt hoàn thành append một mục: ngày (Asia/Bangkok), ID, việc đã làm, file/module, kiểm tra thực, giới hạn và commit reference. Không đánh dấu thành công cho acceptance chưa chạy.

## 2026-10-12 — 001 — Phân tích và quy tắc dự án

- Đã đọc toàn bộ đặc tả; repo ban đầu chỉ có `PROJECT_CONTEXT.md`.
- Giữ VPS control plane / Windows outbound worker, PostgreSQL durable queue và API-first publish.
- Viết `AGENTS.md`, `agent.md`, context rules, kiến trúc, security/API/database, README và roadmap prompt 001–020.
- Giữ bản context nguồn và bản docs đồng bộ; dùng đúng `docs/{promt,processing,completed}` theo yêu cầu.
- Kiểm tra: đọc lại tài liệu và mapping T00–T17; đối chiếu tài liệu Next.js/Prisma chính thức trước bootstrap. Kiểm tra tự động docs sẽ bổ sung trong 002.
- Giới hạn: đây là phân tích và tài liệu; chưa tuyên bố các module nghiệp vụ hoạt động.
- Commit reference: subject `docs(001): document architecture and prompt workflow`.
