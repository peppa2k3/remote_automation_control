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

## 2026-10-13 — 003 — PostgreSQL, migration và stack local

- Prompt 002 đã commit tại `764dea3`. Tiếp tục hoàn thiện phần chưa kiểm chứng của 003; Docker image build từ phiên trước đã thành công, khôi phục Linux engine local sau khi Docker Desktop dừng.
- Thêm migration SystemCheck và integration tests PostgreSQL thật. Compose có profile stack/native với volume riêng, DB nội bộ, API/frontend loopback, non-root Node runtime, healthcheck/memory limits và migration gate.
- Migration dùng chung image backend; frontend chạy Next.js standalone. Điều chỉnh PostgreSQL TCP healthcheck, grace 120 giây + 30 retries sau khi thấy volume mới init chậm trên Windows.
- Thêm setup env local an toàn (random password, exclusive write), stack checker và runtime smoke; cập nhật CI, README, database/operations/architecture docs và mô tả input/output của backlog đã soạn trong đợt khởi tạo.
- Giữ các thư mục lifecycle/ADR rỗng trong Git bằng `.gitkeep`, để clone mới có `docs/processing` và chạy được docs checker.
- PASS: lint, typecheck, 13 unit tests, build Windows và Docker images, migration (kể cả chạy lại idempotent), 3 DB integration tests, FE/API/DB/Agent native smoke, Agent kết nối API Docker, stack health + HTML + manifest/icon + JS/CSS. Actionlint đã pass local.
- Outage/recovery thật PASS: stop đúng PostgreSQL của stack → ready 503/live 200/frontend DB unavailable → start lại → ready 200; SystemCheck có UUID riêng tồn tại qua restart và được xóa sau kiểm tra. Volume không bị reset/xóa.
- Kiểm tra runtime: migrate exit 0 trước backend start; backend/frontend user node; full-stack DB không expose host; ports 3000/4000 và native-dev DB 5432 chỉ loopback. Không thay cấu hình/xóa container của project khác.
- Env và verification artifacts được ignore; setup chạy lại không sửa env hiện hữu. Không commit secret, không deploy VPS hoặc gọi provider publish.
- Giới hạn: chưa CI remote hoặc Browser visual QA; auth/pairing/queue/provider thuộc prompt sau. Native Next CLI smoke có cảnh báo standalone nhưng Docker standalone frontend đã được kiểm tra riêng.
- Kết quả: DONE, chuyển prompt sang `docs/completed/003-database-local-stack.md`. Stack còn chạy để review tại `http://localhost:3000`.
- Commit reference: subject `feat(003): verify PostgreSQL migration and local Docker stack`.

## 2026-10-13 — 004 — Admin auth, RBAC và session

- Prompt 003 đã commit tại `e036ea4`. Hoàn thành 004 với migration User/AuthSession/AuthThrottle/AuditLog, unique owner, scrypt có salt, session opaque chỉ lưu hash trong PostgreSQL và audit transaction.
- CLI owner bootstrap nhập password ẩn/xác nhận qua TTY, không nhận argument/env, không ghi đè owner. HTTP auth login/me/sessions/refresh/logout/revoke-all; role/status mới nhất server-side, OWNER-only audit, chặn anonymous và tách admin/device auth.
- Frontend login/proxy cùng origin, dashboard SSR bảo vệ, controls gia hạn/đăng xuất/thu hồi mọi session; HttpOnly/SameSite Strict, Secure production, CSRF gắn session + Origin, login throttle durable/account/IP và hash queue bounded.
- PASS: lint, typecheck, 27 unit tests, build Windows và Docker; 6 integration PostgreSQL thật trên DB test riêng (bao gồm bootstrap/refresh/revoke/throttle concurrency); migration additive native và Docker, chạy lại idempotent; smoke không DB và có DB, Agent outbound, stack checker và Docker standalone auth runtime.
- CLI thực PASS: tạo một owner test bằng nhập ẩn, lần hai từ chối ghi đè, argument/non-TTY bị từ chối. Xóa đúng fixture; integration chạy lại PASS. Runtime DB native/Docker đều OWNER=0; không tạo credentials mặc định cho người dùng.
- Kiểm tra thực frontend proxy → API → DB: login/cookie/SSR, ADMIN/VIEWER denial, CSRF, rotation/token cũ bị chặn, logout/revoke-all. Phát hiện và sửa Prisma không deserialize kiểu void của SQL advisory lock bằng executeRaw, sau đó test PostgreSQL PASS.
- Cập nhật README, env examples, API/database/security/operations/architecture, AUTH/MFA plan, ADR 001, smoke và Compose healthcheck. Giữ `.env`, volume và container project khác; không commit secret hoặc artifacts, không deploy/publish bên ngoài.
- Giới hạn: MFA mới có kế hoạch và fail closed khi flag bật; chưa reset/user management/retention job, trusted proxy IP policy production, Browser visual QA hoặc CI remote. Native Next CLI smoke có warning standalone; Docker standalone được kiểm tra riêng. Pairing/queue/provider thuộc prompt sau.
- Kết quả: DONE tại `docs/completed/004-admin-auth.md`. Stack chạy ở `http://localhost:3000/login`; người dùng tạo owner cá nhân qua CLI theo README. Tiếp theo 005, có thể thực hiện 011 sớm sau auth theo roadmap.
- Commit reference: subject `feat(004): add owner authentication and revocable sessions`.
