---
id: "004"
title: "Admin auth, RBAC, session và kế hoạch MFA"
status: DONE
depends_on: ["003"]
baseline_task: T02
---

# 004 — Admin auth, RBAC, session và kế hoạch MFA

## Context và mục tiêu

Đọc toàn bộ `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, `docs/CONTEXT_RULES.md`, kiến trúc và module/test liên quan. Mục tiêu: admin auth, rbac, session và kế hoạch mfa. Baseline: T02.

## Phạm vi

Được sửa: backend/modules/auth, frontend/features/auth. Không thay stack, DB shared/production, dịch vụ VPS hiện hữu hoặc module ngoài mục tiêu. Dependencies: 003.

## Input / Output

Input: email/password tại `POST /api/v1/auth/login`; cookie session tại me/logout/refresh. Output: identity/role, HTTP-only session và audit; CLI bootstrap owner không nhận password trong argument/log.

## Business rules / Security

Validate schema và quyền server-side; không log secret/signed URL. Giữ jobs durable và idempotent, không blind retry publish. Agent outbound, không generic shell. Không deploy hoặc public publish khi chưa được cấp quyền hành động đó. Mock phải có nhãn rõ.

## Acceptance criteria

- [x] Bootstrap owner qua CLI an toàn; password hash và session server-side.
- [x] Anonymous bị chặn ở routes nhạy cảm; role checks có negative tests.
- [x] Cookie HttpOnly/Secure/SameSite, CSRF, brute-force limits và session revoke được test.
- [x] Ghi kế hoạch MFA, giới hạn nếu chưa triển khai; không log password/session.
- [x] Lint/typecheck/test/build liên quan pass và cập nhật docs/env examples.
- [x] Kết quả, security review, commit reference và nhật ký được cập nhật.

## Kế hoạch kiểm tra

Chạy lint/typecheck/unit/build; bổ sung integration/runtime smoke và negative tests cho acceptance trong scope. Ghi lệnh và kết quả thực. Không đánh dấu external E2E pass từ mock.

## Kết quả thực hiện

Triển khai ngày 2026-10-13; dependencies 003 đã DONE tại `e036ea4`.

### Thay đổi

- Migration User/AuthSession/AuthThrottle/AuditLog, partial unique OWNER; native scrypt và session opaque hash-only trong PostgreSQL.
- Module auth service/store/HTTP/CLI tại `backend/src/modules/auth`; login/me/sessions/refresh/logout/revoke-all, owner-only audit, mặc định chặn anonymous/mutation không đủ quyền, tách device auth.
- Shared Zod DTO; frontend login, session proxy cùng origin, SSR dashboard bảo vệ, refresh/logout/revoke-all; cập nhật Compose healthcheck, smoke và stack checker.
- Test double chỉ trong tests/helpers; unit negative tests và integration PostgreSQL thật. README, env examples, API/database/security/operations/architecture, `docs/AUTH.md` và ADR 001 đã cập nhật.

### Kiểm tra đã chạy

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`: PASS; 27 unit tests gồm 16 backend, 6 frontend, 3 Agent, 2 contracts.
- Migration trên DB test riêng `automation_auth_004_tests`: PASS; chạy lại không có migration pending. Sáu integration tests PASS (ba DB + ba auth): bootstrap đồng thời/unique owner, role negative, session hash, rotation/revoke race, user disabled và durable/concurrent throttle.
- CLI thực qua TTY vào DB test: tạo owner PASS, mật khẩu không echo; lần hai bị từ chối không ghi đè; command có argument/non-TTY bị từ chối. Đã xóa đúng owner fixture và chạy integration lại xác nhận DB test không còn owner.
- `pnpm smoke` không DB và smoke có SMOKE_DATABASE_URL đến DB test: PASS. API/Next build/Agent thực: login qua proxy, cookie, SSR bảo vệ, thiếu CSRF 403, refresh vô hiệu token cũ, logout redirect. Fixture ADMIN tự dọn; không tạo owner mặc định trong DB runtime.
- `pnpm db:migrate` trên native local DB: PASS, migration additive, không reset hoặc sửa `.env` hiện hữu.
- Docker backend/frontend build và stack local: PASS. Migration exit 0 trước API; backend/frontend healthy, `pnpm stack:check` xác nhận health, anonymous redirect, login và JS/CSS/icon/manifest. Runtime Docker standalone frontend → API → PostgreSQL PASS cho login, SSR, ADMIN audit 403, CSRF 403 và revoke-all/token cũ 401; fixture được dọn. Cả DB native và Docker xác nhận chưa có owner cá nhân (count OWNER=0).

### Cấu hình thủ công và giới hạn

Owner của người dùng chưa được tạo: chạy `pnpm owner:bootstrap` cho native hoặc `docker compose -f infrastructure/compose/compose.yml exec backend pnpm owner:bootstrap` cho Docker trong terminal tương tác. Hai DB có owner riêng. Mở `/login`, nhập credentials cá nhân; không truyền password qua argument/env. Backend production yêu cầu HTTPS origin và bật Secure cookie; Compose HTTP chỉ local development.

MFA mới có kế hoạch trong AUTH; mfaEnabled=true fail closed. Chưa có password reset/user management/retention job; session/audit API giới hạn 100. IP budget hiện chia sẻ khi qua BFF/proxy; deployment cần trust proxy policy được kiểm thử. Native Next CLI smoke có warning standalone; Docker chạy standalone riêng. Chưa CI remote hoặc Browser visual QA, chưa provider E2E/deploy VPS/public publish.

### Security review

Kiểm tra biên trust: role/status đọc lại server-side; ADMIN/VIEWER bị chặn owner audit, anonymous bị chặn nhạy cảm, cookie admin không dùng cho Agent. Origin + JSON + token CSRF gắn session; duplicate cookie bị từ chối, proxy không forward cookie khác/Authorization hay redirect. Password salt/scrypt, token entropy/hash-only, DTO/log/audit không secret, lỗi sanitized; brute-force counter durable và hash queue bounded. SQL transaction locks và unique index được kiểm thử race trên PostgreSQL thật, phát hiện/sửa lỗi deserialize void bằng executeRaw. Giữ env, volume/dữ liệu thật và container project khác; chỉ migration local và fixtures riêng, không secret commit.

Commit reference: subject duy nhất `feat(004): add owner authentication and revocable sessions`. Prompt tiếp theo: 005 device pairing; 011 Meta feasibility có thể bắt đầu sớm sau auth theo roadmap.

Kết quả: DONE; chuyển sang `docs/completed/004-admin-auth.md`, append kết quả vào IMPLEMENTATION_LOG. Stack local giữ chạy tại `http://localhost:3000/login` để tạo owner và review.
