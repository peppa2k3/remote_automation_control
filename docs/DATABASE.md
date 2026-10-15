# Database core

PostgreSQL 17 + Prisma; UUID và timestamps UTC. Schema tại `backend/prisma/schema.prisma`, thay đổi qua `backend/prisma/migrations/`.

| Dữ liệu | Vai trò |
|---|---|
| `users`, `auth_sessions`, `auth_throttles` | Tài khoản, session hash, giới hạn đăng nhập |
| `devices`, `device_members` | Owner/member, metadata, lastSeenAt, runtime snapshot |
| `pairing_codes`, `device_credentials` | Hash mã/token, TTL, rotation/revoke |
| `audit_logs` | Lịch sử auth/device; không chứa secret |
| `SystemCheck` | Fixture kiểm tra DB, không phải queue |

```powershell
pnpm db:up
pnpm db:migrate
```

`db:up` đợi DB healthy. `db:migrate` chạy migrations đã commit; `pnpm build` tự generate Prisma Client. Không dùng reset/db push với dữ liệu cần giữ.

Pair khóa theo mã; heartbeat/rotate/revoke khóa theo device và ghi transaction. OWNER hệ thống duy nhất có partial unique index; không tự có quyền mọi device. ONLINE được suy ra khi đọc, không là cột cho client ghi.

DB native (`postgres-dev-data`) khác DB full stack (`postgres-data`); VPS có volume riêng. `setup:local` chỉ tạo env thiếu, không đổi password của DB đã khởi tạo. Chưa có retention/cleanup định kỳ cho audit/credential hết hạn.

Integration tests chỉ dùng **DB test riêng, đã migrate, không có owner thật**. Đặt `DATABASE_URL` đến DB test trong process, rồi chạy `RUN_DB_TESTS=1 pnpm --filter @automation/backend test:integration` (PowerShell: đặt `$env:RUN_DB_TESTS='1'` trước). Runtime smoke dùng thêm `SMOKE_DATABASE_URL` cùng DB test; không chạy với DB đang sử dụng.
