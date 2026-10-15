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

## 2026-10-13 — 005 — Pairing/heartbeat triển khai, gate Win11 còn thiếu

- Dependency 004 đã commit tại `8aced6c`. Kết quả **PARTIAL**, giữ `docs/processing/005-agent-pairing.md`: máy kiểm thử Windows 10 Pro build 19045, chưa có bằng chứng Windows 11 theo acceptance.
- Thêm pairing/device/credential migration, API OWNER quản lý thiết bị, code random one-use/TTL/budgets durable, bearer device scoped/hash-only, online/offline lastSeen server, revoke và rotation stage/commit có audit/SQL locks.
- Agent native pair/start/heartbeat/rotate, TLS/timeout/response limits, reconnect/backoff; DPAPI CurrentUser + DACL, atomic ciphertext và OS process lock. Pending token được lưu trước network để phục hồi lost rotation response, không plaintext token/env hoặc generic command/inbound.
- Frontend owner /devices + proxy allowlist/CSRF/Origin, hiển thị mã một lần và polling trạng thái/revoke; cập nhật README/docs/env, DEVICES, ADR 002, script Win11 smoke và Windows CI job (chưa CI remote).
- PASS: lint/typecheck/build, 33 unit tests (bao gồm DPAPI thật), 10 integration PostgreSQL (consume/commit/revoke races, scope/CSRF/identity, expired pending/restage, durable limits), native/DB/Docker migrations và Docker images.
- Native Windows 10 + frontend proxy + PostgreSQL thực PASS: pair/DPAPI, reload credential qua process restart, rotate, API outage/restart/reconnect, revoke làm Agent dừng, không code/token/password trong log. Fixture nằm trong DB test riêng, ciphertext ở .verification; dọn đúng dữ liệu và giữ .env/volume/container ngoài project.
- Docker stack healthy, migrate exit 0 trước API; stack checker và auth regression/ADMIN device denial/devices page PASS. Auth smoke không DB/có DB + diagnose Agent PASS; Next native CLI có warning standalone, Docker dùng standalone riêng.
- Giới hạn: gate Win11 chưa chạy; chưa Browser visual QA/remote CI, Windows Service/reboot/multi-user DPAPI hoặc provider E2E, job claim/result, retention/cleanup. Không deploy VPS/public publish. DEVICES.md có hướng dẫn `pnpm agent:smoke` trên Win11 với DB test trống để chốt gate; không chuyển completed hoặc bắt đầu dependency 006 khi chưa đạt gate.
- Commit reference: subject `feat(005): implement scoped device pairing and DPAPI heartbeat`. Khi Win11 PASS, append kết quả xác minh mới rồi chuyển prompt completed; giữ lịch sử PARTIAL này.

## 2026-10-14 — 021 — Core device manager cho người mới

- Theo yêu cầu tích hợp logic `remote-control-agent-core-base`, giữ monorepo Next.js/Express/PostgreSQL và auth/DPAPI/rotation đã hoàn thiện. Không thay DB/framework; không chạy starter như app thứ hai. ADR 003 và context ưu tiên core giám sát trước điều khiển/script.
- Thêm owner theo device, membership OPERATOR/VIEWER, API/UI chia sẻ và lịch sử an toàn; global OWNER không có quyền ngầm xem máy người khác. CLI `user:create` tạo tài khoản qua terminal, password ẩn. Pair code mới 256-bit và local xác nhận URL.
- Heartbeat 5 giây, offline 25 giây; restart API cần heartbeat mới. Agent gửi uptime/RAM/CPU count/hostname; FE snapshot 5 giây, mất server xóa dữ liệu cũ và hiển thị unknown. Chưa có lease/Socket.IO/executor/desktop.
- Migration chỉ thêm owner/member/runtime và backfill device cũ; test nâng cấp dữ liệu 005 giữ nguyên device/credential PASS. Thêm tests filtering, membership escalation/removal, runtime validation, restart/revoke và kiểm tra snapshot/activity qua FE trong native smoke.
- PASS: lint, typecheck, 37 unit tests, build, 13 integration PostgreSQL thật, auth runtime smoke, native Windows 10 Agent smoke (DPAPI/restart/rotate/outage/reconnect/revoke/no-secret logs), Compose config cho Caddy và Traefik, docs check/local links/diff whitespace.
- Hướng dẫn mới: `docs/guides/start-here.md`, `vps-setup.md`, CORE_ROADMAP và prompt 022–024. Mẫu VPS một domain HTTPS với Caddy hoặc Traefik hiện hữu; setup-vps tạo env exclusive/random password. Đưa cả bộ guides đã soạn ở lượt trước vào commit này.
- Môi trường: ổ C hết dung lượng, Docker CLI/DB cũ timeout. Không restart/xóa stack khác; test trên PostgreSQL 17 tạm riêng tại ổ D, loopback 55441; DB fixture và tiến trình được dọn/dừng. Không sửa env runtime có sẵn hoặc deploy lên VPS.
- Giới hạn: chưa browser visual QA (không browser khả dụng), chưa VPS/domain thật/CI remote/build image VPS mới, Linux Agent/Windows Service. Win11 gate 005 vẫn PARTIAL. Operator hiện chỉ xem; control ACK thuộc 022. Core 021 DONE trong phạm vi giám sát, không tuyên bố toàn bộ core starter/desktop đã hoàn tất.
- Commit reference: subject `feat(021): integrate beginner device monitoring core`.

## 2026-10-15 — 021 follow-up — Chẩn đoán kết nối qua proxy

- Tiếp tục nghiệm thu core từ commit `6a7a0d4`; phát hiện `stack:check` gọi audit endpoint không được public trong mẫu VPS. Chuyển kiểm tra ẩn danh sang Device API qua Next, phù hợp cùng domain và local hai port.
- Thêm timeout cho toàn bộ request/body/assets, kiểm tra redirect rõ ràng, tổng hợp lỗi với hướng dẫn tiếng Việt và exit code 1. Không in body/error chứa secret, không thay env runtime hoặc DB.
- Thêm 5 tests dùng HTTP fixture thật tại loopback; tích hợp vào `pnpm test`. Guides bổ sung lệnh kiểm tra VPS từ Windows/Linux và lưu ý Docker treo.
- Docker info vẫn timeout sau 15 giây; ổ C hiện còn khoảng 1,1 GB. Không restart engine hoặc đụng dữ liệu stack khác. Chưa build/run image VPS, deploy HTTPS thật hoặc nghiệm thu Windows 11. 022 vẫn PLANNED theo ưu tiên kiểm chứng core trước điều khiển.
- Commit reference: `fix(021): make stack checks work through the VPS proxy`.
- PASS: lint, typecheck, 5 script tests + 37 unit tests, build, docs lifecycle/context, diff whitespace. DB/DPAPI smoke không chạy lại ở đợt sửa công cụ này; kết quả runtime trước đó giữ theo mục 14/10, không coi fixture là bằng chứng VPS thật.

## 2026-10-15 — 025 — Corebase gọn cho máy mới

- Gom context/README/AGENTS/architecture và guides vào core login → pair → heartbeat → web giám sát. Một hướng dẫn chính `docs/guides/start-here.md`; baseline automation chuyển vào archive, backlog giữ riêng. Đồng bộ API/auth/device/database/security/operations và bỏ biến env tương lai.
- Thêm lệnh DB đợi healthy và aliases Agent. Sửa gia hạn session để các form nhận CSRF mới qua router refresh; giữ quyền/identity/schema hiện tại.
- PASS: setup mới biệt lập + không ghi đè khi chạy lại, 4 nhánh Compose config, local links, lint/typecheck, 42 tests, build/docs/diff check.
- PASS với PostgreSQL 17 biệt lập: 4 migrations, 13 integration tests, auth/SSR/CSRF/session smoke và native Windows 10 Agent DPAPI/restart/rotation/outage/reconnect/revoke/log smoke. Dọn DB fixture và dừng DB tạm; không sửa env/runtime DB của người dùng.
- Chưa nghiệm thu máy Windows 11 mới, browser click sau sửa CSRF, Docker images hoặc VPS/domain thật; gate 005 giữ PARTIAL. Đây là core giám sát để bắt đầu chạy, chưa bảo đảm vận hành 24/7.
- Commit reference: `refactor(025): simplify corebase first-run setup`.
