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

## 2026-10-12 — 002 — Bootstrap monorepo

- Prompt 001 đã commit tại `93b57b2`; `pnpm docs:check` xác nhận 20 prompt duy nhất và context đồng bộ.
- Tạo 4 workspace: shared Zod contracts, Next.js/Tailwind frontend, Express/Prisma backend, Agent native TypeScript.
- Frontend hiển thị API/DB health thật, nút refresh, layout responsive, PWA manifest/icon; chưa có job giả hoặc chức năng publish.
- API có live/ready, envelope/requestId, JSON logs, graceful shutdown, CORS/Helmet/rate limit và xử lý lỗi an toàn.
- Agent diagnose outbound có HTTPS policy, timeout, validation, exit code; chưa pairing hoặc claim.
- Khóa dependencies; pnpm 11 allowBuilds explicit, ESLint 10, Prettier, Vitest, CI và scripts kiểm tra docs/runtime.
- Kết quả: lint PASS, typecheck PASS, unit 13/13 PASS, build PASS, runtime smoke FE/API/Agent PASS (live 200, DB chưa cấu hình -> ready 503).
- Giới hạn: Browser không có kết nối, chưa visual QA; CI chưa chạy remote. PostgreSQL migration/full Docker stack thuộc 003; auth và nghiệp vụ thuộc 004 trở đi.
- Security review: không secret, không external publish/deploy, không inbound Agent hoặc generic shell.
- Commit reference: subject `feat(002): bootstrap typed control platform and diagnostics`.
