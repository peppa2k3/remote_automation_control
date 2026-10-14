---
id: "021"
title: "Core device manager — tích hợp logic starter"
status: DONE
depends_on: ["004"]
baseline_task: "CORE-01"
---

# 021 — Local device → server/VPS → web manager

Yêu cầu ngày 14/10/2026 ưu tiên core giám sát dễ học trước điều khiển nâng cao. Đọc source `remote-control-agent-core-base` để chuyển logic phù hợp vào monorepo hiện tại. Giữ auth, PostgreSQL, Next.js, DPAPI và credential rotation từ 004/005. 005 vẫn giữ gate Windows 11 riêng; công việc này không chứng nhận gate đó.

## Phạm vi và quyết định

- Mỗi device có một owner; member có role viewer/operator. Admin hệ thống tạo tài khoản bằng CLI; quyền device kiểm tra riêng phía backend.
- Enrollment 256-bit, TTL/one-use; xác nhận URL tại local trước pairing.
- Heartbeat 5 giây, offline sau 25 giây; web poll 5 giây, mất server là unknown. REST hiện có được giữ để giảm số giao thức phải học; Socket.IO và lease ACK chuyển bước tiếp.
- Runtime cơ bản (uptime/RAM/CPU count), lịch sử hoạt động an toàn, tài liệu local/VPS HTTPS.
- Không nhập SQLite/Vite, MeshCentral, shell executor hoặc lease chưa kiểm chứng vào runtime.

## Kiểm tra / acceptance

- [x] Migration bổ sung ownership/member/runtime không xóa dữ liệu cũ; upgrade test với dữ liệu 005 đã đạt.
- [x] Pair → heartbeat → web list/activity, quyền owner/member/outsider và revoke được kiểm thử.
- [x] FE xóa snapshot/mã hiển thị khi mất server và báo unknown; unit feed kiểm tra lỗi/response sai, đã review logic UI. Browser visual QA chưa chạy do browser không khả dụng.
- [x] Lint/typecheck/37 unit tests/13 integration tests/build và runtime smoke đạt.
- [x] Hướng dẫn từng bước local, VPS mới với Caddy và VPS có Traefik; chưa test domain/VPS thật.

## Kết quả

DONE cho phạm vi core giám sát đã xác định, không phải toàn bộ lease/desktop của starter.

## Files changed

- Contracts runtime/role/code 256-bit; migration/schema Device owner/member/runtime; DeviceService/HTTP authorization, activity và presence; user:create CLI.
- Agent runtime aggregate, heartbeat 5s, consent URL khi pair; giữ DPAPI/rotation và scopes cũ.
- FE /devices: snapshot quyền theo máy, unknown khi mất kết nối, runtime/activity, members; proxy allowlist được mở đúng endpoint.
- VPS Compose/Caddy và override Traefik; setup-vps script không ghi đè env. Source tham khảo loại khỏi lint/format/Docker context.
- README/AGENTS/context đồng bộ, ADR 003, CORE_ROADMAP, guides, prompt 022–024 và nhật ký.

## Validation 14/10/2026

- `pnpm lint`, `pnpm typecheck`, `pnpm test` (37), `pnpm build`: PASS.
- PostgreSQL 17 tạm tại loopback 55441 trên ổ D: 4 migrations PASS; `RUN_DB_TESTS=1 pnpm --filter @automation/backend test:integration`: 13 tests PASS. Có test nâng cấp schema 005 chứa device/credential cũ.
- `pnpm smoke` với DB test riêng: PASS auth/cookie/CSRF/SSR/refresh/logout và Agent diagnose.
- `pnpm agent:smoke --allow-windows-10` với DB test riêng: PASS native DPAPI, process restart, rotate, API outage/reconnect, revoke, snapshot runtime/activity qua FE và secret-free logs. Không thay thế gate Windows 11 của 005.
- `docker compose ... config --quiet` cho cả hai nhánh VPS: PASS. Nhánh Traefik chỉ có postgres/migrate/backend/frontend; gateway Caddy không được bật.
- Markdown local links, docs lifecycle/context và `git diff --check`: PASS.

## Cấu hình và giới hạn

Chạy [start-here](../guides/start-here.md), sau đó [VPS](../guides/vps-setup.md). Không migrate/reset DB runtime hoặc sửa env có sẵn trong phiên này. Máy hiện tại ổ C hết dung lượng, Docker API/PostgreSQL cũ timeout; không restart Docker/stack khác. Kiểm thử DB thật chuyển sang PostgreSQL độc lập trên ổ D, đã dừng sau test. Chưa build/run image VPS mới, chưa browser visual QA, chưa deploy HTTPS/VPS thật hoặc CI remote. Cần người dùng giải phóng dung lượng để Docker hoạt động trở lại; không tự xóa dữ liệu ngoài task.

Lease/ACK/Socket.IO, desktop/MeshCentral, script executor, Linux Agent, Windows Service và scale nhiều backend chưa triển khai. Rate limit hiện gộp IP sau proxy, chỉ phù hợp số ít máy/người dùng. Gate Win11 005 giữ PARTIAL. Backend/Agent mới nên nâng cấp cùng nhau do nhịp heartbeat đổi 30s → 5s.

## Security review

Mọi đọc/mutation device lọc owner/member tại backend, không dựa role UI; CSRF/Origin/bearer giữ nguyên. Runtime schema strict; không file/process scan hoặc executor. Pair code mới 256-bit, không log secret; credential vẫn DPAPI và hash DB. Mẫu VPS không publish DB/FE/API ra host; proxy giữ nguyên route native và route browser tới Next. Migration bổ sung/backfill, không xóa dữ liệu.

Commit reference: `feat(021): integrate beginner device monitoring core`.
Tiếp theo: nghiệm thu local/VPS theo guide; 022 khi cần phiên điều khiển có local ACK.
