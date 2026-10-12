---
id: "002"
title: "Bootstrap monorepo và runtime nền tảng"
status: DONE
depends_on: ["001"]
baseline_task: T00
---

# 002 — Bootstrap monorepo và runtime nền tảng

## Context và mục tiêu

Đọc toàn bộ `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, `docs/CONTEXT_RULES.md`, kiến trúc và module/test liên quan. Mục tiêu: bootstrap monorepo và runtime nền tảng. Baseline: T00.

## Phạm vi

Được sửa: frontend, backend, agent-windows, packages/contracts, scripts, CI. Không thay stack, DB shared/production, dịch vụ VPS hiện hữu hoặc module ngoài mục tiêu. Dependencies: 001.

## Input / Output

Input: cấu hình/env và dữ liệu hợp lệ của module; đọc baseline để xác định payload cụ thể. Output: hành vi trong checklist dưới đây, test có bằng chứng và tài liệu đồng bộ.

## Business rules / Security

Validate schema và quyền server-side; không log secret/signed URL. Giữ jobs durable và idempotent, không blind retry publish. Agent outbound, không generic shell. Không deploy hoặc public publish khi chưa được cấp quyền hành động đó. Mock phải có nhãn rõ.

## Acceptance criteria

- [x] pnpm install với lockfile; lint/typecheck/unit/build đều pass.
- [x] Frontend responsive hiển thị health thật, không tạo dữ liệu job giả.
- [x] API live/ready envelope có requestId; lỗi không lộ secret.
- [x] Agent diagnose outbound có timeout, validate response và exit code đúng.
- [x] CI và .env.example có thể tái tạo bootstrap.
- [x] Lint/typecheck/test/build liên quan pass và cập nhật docs/env examples.
- [x] Kết quả, security review, commit reference và nhật ký được cập nhật.

## Kế hoạch kiểm tra

Chạy lint/typecheck/unit/build; bổ sung integration/runtime smoke và negative tests cho acceptance trong scope. Ghi lệnh và kết quả thực. Không đánh dấu external E2E pass từ mock.

## Kết quả thực hiện

Trạng thái: DONE.

- Files: pnpm workspace/lockfile, strict tsconfigs, ESLint 10 + Prettier + Vitest, packages/contracts, frontend, backend health + Prisma scaffold, Agent CLI, scripts/check-docs.mjs, scripts/smoke.mjs và CI.
- Lệnh thực: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (13/13), `pnpm build`, `pnpm smoke` đều pass. Smoke khởi chạy bản build API/FE và Agent native thật, kiểm tra API live 200, ready 503 khi chưa cấu hình DB, HTML trạng thái và manifest.
- Security review: requestId do server sinh; không log body/query/secret; safe error, CORS origin, Helmet, rate limit, body limit; Agent HTTPS mặc định, chỉ explicit localhost HTTP cho dev.
- Cấu hình thủ công: env local, DB và provider trong prompt tiếp theo. Không có secret thật trong source.
- Giới hạn: Browser không có phiên khả dụng nên chưa visual QA; responsive CSS đã tạo, runtime/HTML được test. PWA có manifest/icon, chưa offline service worker. Auth/pairing/queue/publish chưa triển khai. CI đã scaffold, chưa chạy trên GitHub remote.
- Commit reference: subject `feat(002): bootstrap typed control platform and diagnostics`.
- Tiếp theo: 003 PostgreSQL migration và full stack local.

