# Cấu hình FE, BE, DB và Agent

Core 021: heartbeat 5 giây, offline 25 giây và web poll 5 giây là hằng số giao thức, không cần thêm biến env. Role owner/member lấy từ DB theo thiết bị. Mẫu VPS riêng dùng `infrastructure/vps/.env` với PUBLIC_DOMAIN, ACME_EMAIL và các biến POSTGRES_*; tạo bằng `node scripts/setup-vps.mjs <domain> <email>` theo [VPS guide](vps-setup.md).

Chỉ sửa file env của **cách chạy đang dùng**. `pnpm setup:local` tạo file còn thiếu mà không ghi đè file có sẵn. Các giá trị ở bảng là mẫu local; dùng mật khẩu sinh ngẫu nhiên, không dùng placeholder của `.env.example` để kết nối DB.

| File | Ai đọc | Vai trò |
|---|---|---|
| `infrastructure/compose/.env` | Docker Compose | Tài khoản DB và port host; Compose không tự đọc env của backend/frontend |
| `backend/.env` | BE native và Prisma CLI native | API, origin FE, URL DB native, phiên admin |
| `frontend/.env.local` | Next.js native | URL API công khai, URL API nội bộ, origin FE |
| `agent-windows/.env` | Agent native | URL API, chính sách local HTTP, timeout, nơi lưu DPAPI |

## PostgreSQL và Compose

| Biến trong `infrastructure/compose/.env` | Mặc định/mẫu | Ý nghĩa |
|---|---|---|
| `POSTGRES_USER`, `POSTGRES_DB` | `automation` | User và tên database local |
| `POSTGRES_PASSWORD` | Do `setup:local` sinh | Mật khẩu DB; chỉ dùng hex ngẫu nhiên ít nhất 32 ký tự cho script setup |
| `POSTGRES_DEV_PORT` | `5432` | Cổng host của `postgres-dev`, bind `127.0.0.1` |
| `BACKEND_PORT`, `FRONTEND_PORT` | `4000`, `3000` | Cổng host của stack Docker, bind `127.0.0.1` |

Ở native, `backend/.env` có `DATABASE_URL=postgresql://<user>:<password>@localhost:<POSTGRES_DEV_PORT>/<db>`. Ở Docker stack, Compose tự đặt `DATABASE_URL=postgresql://<user>:<password>@postgres:5432/<db>` cho BE và migration. `postgres` là tên service **trong mạng Docker**, không phải hostname mà tiến trình native sử dụng. Hai profile có volume DB khác nhau.

## Backend native

| Biến trong `backend/.env` | Mẫu | Ý nghĩa |
|---|---|---|
| `NODE_ENV` | `development` | Chế độ chạy; production yêu cầu `DATABASE_URL` và HTTPS `FRONTEND_ORIGIN` |
| `HOST`, `PORT` | `127.0.0.1`, `4000` | Địa chỉ/cổng BE native |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | Origin FE chính xác để kiểm tra request và CORS; không có dấu `/` cuối |
| `DATABASE_URL` | Do `setup:local` điền | Kết nối PostgreSQL native |
| `LOG_LEVEL` | `info` | Mức log Pino |
| `AUTH_SESSION_SECONDS` | `1800` | Thời hạn phiên ngắn, tính bằng giây |
| `AUTH_ABSOLUTE_SECONDS` | `28800` | Thời hạn tuyệt đối; không được ngắn hơn phiên ngắn |

Trong Docker stack, Compose đặt trực tiếp env backend với `HOST=0.0.0.0`, `PORT=4000`, `NODE_ENV=development`, URL DB nội bộ và `FRONTEND_ORIGIN` theo `FRONTEND_PORT`. `HOST=0.0.0.0` chỉ để service nghe **trong container**; port publish trên host vẫn bind loopback.

## Frontend

| Biến trong `frontend/.env.local` | Mẫu | Ý nghĩa |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:4000/api/v1` | URL API theo góc nhìn host, hiện là fallback cho Next server; giá trị `NEXT_PUBLIC_*` gắn vào build |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | URL site công khai, fallback origin của proxy; gắn vào build |
| `API_INTERNAL_BASE_URL` | `http://localhost:4000/api/v1` | URL Next.js server gọi BE; trong Docker là `http://backend:4000/api/v1` |
| `AUTH_FRONTEND_ORIGIN` | `http://localhost:3000` | Origin runtime của proxy auth/device; phải bằng BE `FRONTEND_ORIGIN` |

Frontend Docker nhận `NEXT_PUBLIC_*` qua build args và `API_INTERNAL_BASE_URL` qua env container. Đổi `BACKEND_PORT`/`FRONTEND_PORT` của stack cần `docker compose -f infrastructure/compose/compose.yml --profile stack up --build -d` để các URL build-time được cập nhật. Dùng `localhost` nhất quán trong browser và origin; `http://127.0.0.1:3000` là origin khác.

## Windows Agent

| Biến trong `agent-windows/.env` | Mẫu | Ý nghĩa |
|---|---|---|
| `AGENT_API_BASE_URL` | `http://localhost:4000/api/v1` | BE mà Agent gọi trực tiếp; không trỏ vào FE |
| `AGENT_ALLOW_LOCAL_HTTP` | `true` cho local | Chỉ cho phép HTTP ở `localhost`/loopback; các host khác cần HTTPS |
| `AGENT_REQUEST_TIMEOUT_MS` | `5000` | Timeout request, hợp lệ 100–30000 ms |
| `AGENT_STATE_DIR` | Bỏ trống | Thư mục cha tuyệt đối tùy chọn; mặc định `%LOCALAPPDATA%/AutomationControl` |

Credential nằm trong thư mục con `device-identity` và được mã hóa bằng DPAPI CurrentUser; không đặt token hay device ID vào `.env`. Các biến comment trong env mẫu về Socket.IO, worker, provider/S3 và secret tương lai **chưa được sử dụng** ở giai đoạn hiện tại.

## Biến chỉ dùng khi kiểm tra

| Biến đặt cho tiến trình chạy lệnh | Lệnh dùng | Ý nghĩa |
|---|---|---|
| `CHECK_API_BASE_URL`, `CHECK_SITE_URL` | `pnpm stack:check` | Ghi đè URL kiểm tra khi đổi cổng; mặc định là API `localhost:4000/api/v1` và FE `localhost:3000` |
| `RUN_DB_TESTS=1` | `pnpm --filter @automation/backend test:integration` | Bật integration test trên `DATABASE_URL` của **DB test riêng đã migrate** |
| `SMOKE_DATABASE_URL` | `pnpm smoke`, `pnpm agent:smoke` | DB test riêng cho runtime smoke; không trỏ vào DB có owner/device đang dùng |

Các biến này không cần điền vào env local để sử dụng giao diện. Xem [kiểm tra và xử lý lỗi](verification.md) trước khi chạy smoke có DB.

Không dùng file env local cho production. Tham chiếu [SECURITY](../SECURITY.md), [AUTH](../AUTH.md) và [DEVICES](../DEVICES.md) trước khi đổi chính sách origin, TLS hoặc credential.
