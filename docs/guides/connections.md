# Luồng kết nối hiện tại

Core 021 mở quyền xem cho owner/member theo từng device; user đăng nhập được tạo mã cho máy mình. FE lấy snapshot REST mỗi 5 giây, Agent heartbeat 5 giây, offline sau 25 giây không liên lạc. Mất server hoặc phiên đăng nhập làm FE xóa snapshot và báo unknown. Không có WebSocket/lease/desktop trong bước này. [Lộ trình](../CORE_ROADMAP.md).

## Đăng nhập và quản lý thiết bị

```mermaid
sequenceDiagram
  participant Browser
  participant Next as Next.js :3000
  participant API as Express :4000
  participant DB as PostgreSQL
  Browser->>Next: POST /api/v1/auth/login
  Next->>API: POST /api/v1/auth/login (Origin, JSON)
  API->>DB: Xác thực owner, tạo session
  API-->>Next: Cookie HttpOnly và CSRF
  Next-->>Browser: Cookie và kết quả
  Browser->>Next: GET /devices
  Next->>API: GET /api/v1/auth/me (cookie)
  API->>DB: Đọc session/quyền
  Next-->>Browser: Trang thiết bị nếu có quyền
```

Browser dùng route Next.js cùng origin `/api/v1/auth/{action}` và `/api/v1/devices/...`. Next chỉ proxy các path/method được cho phép, chuyển cookie phiên và header CSRF cần thiết; BE kiểm tra session, Origin và quyền OWNER ở server. Các mutation cần `Origin`, JSON và `X-CSRF-Token` khi đã đăng nhập. Đừng gọi BE trực tiếp từ một origin khác và mong cookie frontend tự hoạt động. Server-side render của Next gọi `API_INTERNAL_BASE_URL` để đọc session/health; khi thiếu biến này mới dùng `NEXT_PUBLIC_API_BASE_URL` làm fallback.

`FRONTEND_ORIGIN` ở BE, `AUTH_FRONTEND_ORIGIN` ở FE và địa chỉ mở trên browser phải khớp **scheme + hostname + port**. Với mặc định, dùng `http://localhost:3000` cho cả ba. `NEXT_PUBLIC_API_BASE_URL` là địa chỉ mà host/trình duyệt có thể tới; `API_INTERNAL_BASE_URL` trong Compose là tên service Docker `backend`, không dùng URL này trong trình duyệt. FE không biết mật khẩu DB và không truy cập PostgreSQL trực tiếp.

## Agent ghép đôi và heartbeat

```mermaid
sequenceDiagram
  participant Owner as Owner tại /devices
  participant API as Express API
  participant DB as PostgreSQL
  participant Agent as Windows Agent
  Owner->>API: Tạo mã pair (qua Next proxy)
  API->>DB: Lưu hash và thời hạn 5 phút
  API-->>Owner: Hiển thị mã một lần
  Agent->>API: POST /api/v1/agent/pair (mã)
  API->>DB: Tiêu thụ mã, tạo device/credential
  API-->>Agent: Token một lần
  Agent->>Agent: Lưu DPAPI CurrentUser
  Agent->>API: POST /api/v1/agent/heartbeat (Bearer)
  API->>DB: Cập nhật lastSeenAt
```

Agent gọi BE **trực tiếp**, không qua FE và không dùng cookie admin. API phân biệt bearer credential của device với session admin. Agent chỉ mở kết nối outbound; `start` hiện chỉ heartbeat/reconnect và tự xoay credential khi gần hết hạn. Owner revoke từ `/devices`; Agent bị revoke dừng khi nhận lỗi xác thực. Xem [DEVICES](../DEVICES.md) cho TTL, rotate và recovery.

## Health và địa chỉ theo cách chạy

| Thành phần | Native + DB Docker | Full stack Docker |
|---|---|---|
| Browser → FE | `http://localhost:3000` | `http://localhost:3000` (hoặc `FRONTEND_PORT`) |
| Host/Agent cùng máy → BE | `http://localhost:4000/api/v1` | `http://localhost:4000/api/v1` (hoặc `BACKEND_PORT`) |
| Next server → BE | `http://localhost:4000/api/v1` | `http://backend:4000/api/v1` |
| BE → DB | `localhost:5432` (hoặc `POSTGRES_DEV_PORT`) | `postgres:5432` |

`GET /api/v1/health/live` xác nhận tiến trình BE đang chạy; `GET /api/v1/health/ready` kiểm tra BE kết nối được DB và trả 503 nếu DB không sẵn sàng. Health không chứng minh migration/owner/pairing đã thành công. Xem [kiểm tra và xử lý lỗi](verification.md).
