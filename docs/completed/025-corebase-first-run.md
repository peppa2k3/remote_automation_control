---
id: "025"
title: Corebase ngắn gọn cho máy mới
status: DONE
depends_on: ["021"]
baseline_task: NONE
---

# 025 — Corebase cho lần chạy đầu

## Mục tiêu và phạm vi

Rà luồng cài đặt/kết nối; thống nhất context, kiến trúc và guides cho Windows mới. Giữ core login → pair → heartbeat → web giám sát. Lưu thiết kế automation cũ vào archive; không triển khai tính năng mới hoặc sửa env/DB thật.

## Quy tắc

- Một hướng dẫn local chính; VPS là bước kế tiếp.
- DB phải healthy trước migration. Lệnh ngắn và đúng scripts thực tế.
- Auth session và device credential riêng; quyền owner/member tại backend.
- Không tuyên bố nghiệm thu Windows 11/VPS nếu chưa chạy thực tế.

## Acceptance

- [x] Context/architecture/README/guides ngắn, đồng nhất với code.
- [x] Máy mới có đủ bước cài công cụ, cấu hình, DB, tài khoản, web, Agent và chạy lại.
- [x] Lệnh khởi động DB đợi readiness; env mẫu chỉ chứa biến hiện dùng.
- [x] Kiểm tra fresh setup biệt lập, lint/typecheck/test/build và runtime core phù hợp.
- [x] Context đồng bộ, local links hợp lệ, log và commit riêng.

## Kiểm tra và kết quả

- Rút context ~764 → 38 dòng; đồng bộ bản docs. README/AGENTS/architecture/guides và API/auth/database/devices/security/operations chỉ mô tả core hiện có. Baseline cũ giữ tại `docs/archive/automation-baseline.md`; roadmap cũ được đánh dấu backlog.
- Thêm aliases `db:up` (đợi healthy 180s), `db:stop`, `agent:diagnose`, `agent:pair`, `agent:start`. Env mẫu bỏ biến tương lai; không sửa env thật hoặc thêm dependency.
- Sửa `SessionControls`: sau refresh session, gọi `router.refresh()` để các form device nhận CSRF mới.
- PASS: fresh setup trong thư mục tạm, password/URL/env khớp, setup lại không ghi đè; Compose config native/stack/VPS Caddy/Traefik; toàn bộ local Markdown links.
- PASS: `pnpm lint`, `pnpm typecheck`, `pnpm test` (5 script + 37 unit), `pnpm build`, `pnpm docs:check`, `git diff --check`.
- PASS: PostgreSQL 17 tạm trên loopback 55441, 4 migrations, 13 integration tests; auth/SSR/CSRF/session smoke; native Agent DPAPI/restart/rotate/outage/reconnect/revoke/log smoke Windows 10. DB test được xóa, PostgreSQL tạm được dừng.
- Giới hạn: chưa click-test browser sau sửa CSRF; chưa chạy trọn quy trình cài đặt trên máy Windows 11 mới, build/run Docker images hoặc nghiệm thu VPS/domain thật. Không nâng gate 005. Không tuyên bố ổn định 24/7 từ smoke test.
- Security: giữ identity/quyền/DPAPI/TLS/CSRF; không reset DB, sửa secret hay deploy bên ngoài.
- Commit reference: `refactor(025): simplify corebase first-run setup`.
