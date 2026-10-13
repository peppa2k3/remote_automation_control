---
id: "003"
title: "PostgreSQL, migration và stack Docker local"
status: DONE
depends_on: ["002"]
baseline_task: T01
---

# 003 — PostgreSQL, migration và stack Docker local

## Context và mục tiêu

Đọc toàn bộ `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, `docs/CONTEXT_RULES.md`, kiến trúc và module/test liên quan. Mục tiêu: postgresql, migration và stack docker local. Baseline: T01.

## Phạm vi

Được sửa: backend/prisma, database integration, infrastructure/compose, CI. Không thay stack, DB shared/production, dịch vụ VPS hiện hữu hoặc module ngoài mục tiêu. Dependencies: 002.

## Input / Output

Input: env local, schema Prisma và Docker Compose của project `home-automation-local`. Output: migration được áp dụng, Prisma CRUD chạy trên PostgreSQL 17, frontend/API/DB kết nối thật và health phản ánh đúng trạng thái database.

## Business rules / Security

Validate schema và quyền server-side; không log secret/signed URL. Giữ jobs durable và idempotent, không blind retry publish. Agent outbound, không generic shell. Không deploy hoặc public publish khi chưa được cấp quyền hành động đó. Mock phải có nhãn rõ.

## Acceptance criteria

- [x] Migrate PostgreSQL 17 local thành công và Prisma write/read/delete pass.
- [x] Full stack FE/API/DB chạy thật; API ready 200 và FE truy cập được.
- [x] DB unavailable trả 503, live vẫn 200; migration chạy trước backend.
- [x] Docker Compose dùng namespace/volume riêng và không đụng container hiện hữu.
- [x] Lint/typecheck/test/build liên quan pass và cập nhật docs/env examples.
- [x] Kết quả, security review, commit reference và nhật ký được cập nhật.

## Kế hoạch kiểm tra

Chạy lint/typecheck/unit/build; bổ sung integration/runtime smoke và negative tests cho acceptance trong scope. Ghi lệnh và kết quả thực. Không đánh dấu external E2E pass từ mock.

## Kết quả thực hiện

Trạng thái: DONE — hoàn thành ngày 2026-10-13 (Asia/Bangkok).

### Thay đổi

- `backend/prisma/migrations/20261012000100_system_check/migration.sql` và migration lock: tạo SystemCheck bằng migration versioned, không reset database.
- `backend/tests/integration/database.test.ts`: PostgreSQL thật, Prisma create/read/delete + unique label, ready 200 và connection failure 503/live 200.
- `infrastructure/compose/{Dockerfile,compose.yml,.env.example}`: PostgreSQL 17, Node.js 24, frontend standalone, API/frontend user node; migrate dùng chung image backend và hoàn tất trước API.
- Healthcheck PostgreSQL dùng TCP; startup grace 120 giây + 30 retries để volume mới có thời gian init trên Windows. Backend/frontend có healthcheck, restart policy và memory limits.
- `scripts/setup-local.mjs`, `scripts/check-stack.mjs`, `scripts/smoke.mjs`, package scripts, Docker ignore và CI; đồng bộ README, database/operations/architecture docs. Hoàn thiện input/output mô tả backlog từ yêu cầu khởi tạo trước đó, không triển khai các prompt nghiệp vụ.
- Thêm `.gitkeep` cho các thư mục lifecycle/ADR: clone mới vẫn có `docs/processing` khi chưa có prompt đang làm, tránh `docs:check` lỗi vì thư mục rỗng không được Git lưu.

### Kiểm tra thực tế

- `pnpm lint`, `pnpm typecheck`, `pnpm test`: PASS (13/13 unit tests); `pnpm build`: PASS trên Windows ngày 2026-10-13.
- Docker Compose image build: PASS, có image backend/frontend; full stack `up -d --no-build`: PASS. Log migration áp dụng đúng một migration; service migrate exit 0 trước backend started.
- `pnpm db:migrate`: PASS trên native-dev DB, chạy lại báo no pending migrations. `RUN_DB_TESTS=1 pnpm --filter @automation/backend test:integration`: PASS (3/3).
- `pnpm stack:check`: PASS live/ready 200, frontend hiển thị API/DB thật, manifest/icon và toàn bộ JS/CSS được phục vụ.
- Native runtime smoke với database thật: PASS FE–API–DB–Agent. `pnpm --filter @automation/agent-windows diagnose`: PASS outbound tới API Docker.
- Kiểm tra outage thật: tạo một SystemCheck UUID riêng trong DB full stack → `docker compose ... stop --timeout 60 postgres` → ready 503, live 200, frontend báo database chưa sẵn sàng → start postgres → ready 200. Record vẫn tồn tại qua restart và được xóa đúng UUID sau kiểm tra.
- `setup:local` giữ nguyên hash của các env có sẵn khi chạy lại; actionlint PASS; `git diff --check` PASS. Env và verification artifacts được Git ignore.

### Security review / cấu hình / giới hạn

- Chỉ API 4000 và FE 3000 bind host loopback; DB full stack không publish port. Dev DB 5432 chỉ bind loopback. Namespace và hai volume PostgreSQL riêng; không stop/remove/recreate container ngoài project, không reset/xóa volume.
- Env local chứa mật khẩu random, không được commit; setup không ghi đè config có sẵn. Provider/production secrets chưa được cấu hình.
- Stack đang chạy tại `http://localhost:3000`, API `http://localhost:4000/api/v1`. Theo README để đổi port hoặc chạy native; tránh start native FE/API trên port đang được Docker dùng.
- CI scaffold đã được kiểm tra local, chưa chạy GitHub remote. Browser visual QA chưa thực hiện; runtime HTML và build assets đã được kiểm tra thật. Native smoke dùng Next CLI có cảnh báo standalone; container frontend chạy đúng standalone entrypoint và đã được kiểm tra riêng.
- Bootstrap local hoàn tất; không tuyên bố production-ready hoặc Meta publishing hoạt động.

Commit reference: subject `feat(003): verify PostgreSQL migration and local Docker stack`.

Tiếp theo: prompt 004 — Admin auth, RBAC, session và kế hoạch MFA.

