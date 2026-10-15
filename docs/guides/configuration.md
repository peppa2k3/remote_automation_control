# Cấu hình core

`pnpm setup:local` tạo các file dưới đây cho máy mới. Giữ mặc định khi chạy lần đầu; không điền token hoặc secret vào biến `NEXT_PUBLIC_*`.

| File | Nội dung chính |
|---|---|
| `infrastructure/compose/.env` | User/DB/password PostgreSQL, port DB `5432`, API `4000`, web `3000` |
| `backend/.env` | `DATABASE_URL`, `HOST=127.0.0.1`, `PORT=4000`, `FRONTEND_ORIGIN=http://localhost:3000` |
| `frontend/.env.local` | `NEXT_PUBLIC_SITE_URL` và `AUTH_FRONTEND_ORIGIN=http://localhost:3000`; `API_INTERNAL_BASE_URL` và `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1` |
| `agent-windows/.env` | `AGENT_API_BASE_URL=http://localhost:4000/api/v1`, `AGENT_ALLOW_LOCAL_HTTP=true`, timeout `5000` ms |
| `infrastructure/vps/.env` | Tạo riêng bằng `setup-vps.mjs`; domain/email/password DB VPS |

Đổi port/password DB: đồng bộ compose env và backend `DATABASE_URL`. Đổi port web: đồng bộ URL site và Origin ở FE/BE. Đổi port API: đồng bộ backend, URL API ở FE và Agent. `setup:local` giữ file đã có, không tự sửa cấu hình cũ.

Trong Docker, Next gọi `http://backend:4000/api/v1`, API gọi `postgres:5432`. `localhost` trên Agent luôn là chính máy Agent; dùng domain HTTPS để gọi VPS.

Agent chỉ chấp nhận HTTP ở loopback khi bật rõ; VPS dùng `AGENT_ALLOW_LOCAL_HTTP=false`. `AGENT_STATE_DIR` là thư mục cha tuyệt đối tùy chọn, mặc định `%LOCALAPPDATA%/AutomationControl`; credential nằm trong `device-identity/`, DPAPI CurrentUser. Không nhập device ID/token vào env.

Đổi env cần restart tiến trình; thay `NEXT_PUBLIC_*` cần build lại. File env thật không commit. Session mặc định 30 phút, tối đa 8 giờ; cấu hình qua `AUTH_SESSION_SECONDS`/`AUTH_ABSOLUTE_SECONDS` của backend.
