# API hiện tại

Base path `/api/v1`. Envelope luôn có `success`, `data`, `error`, `requestId`. Header `X-Request-Id` trùng trường JSON. Error chỉ có `code` và thông báo an toàn.

| Method / path | Status | Hành vi |
|---|---|---|
| `GET /health/live` | 200 | Tiến trình API đang chạy, không phụ thuộc DB |
| `GET /health/ready` | 200 / 503 | `SELECT 1` qua Prisma thành công / thất bại |
| Path `/api/v1` nhạy cảm chưa đăng nhập | 401 | `AUTH_REQUIRED` |
| Path chưa triển khai, đã xác thực/đủ quyền | 404 | `NOT_FOUND`, không có tác dụng phụ |
| JSON body sai | 400 | `INVALID_JSON` |
| Body quá lớn | 413 | `PAYLOAD_TOO_LARGE` |
| Vượt rate limit | 429 | `RATE_LIMITED` |

Ví dụ live:

```json
{"success":true,"data":{"service":"backend","status":"ok","timestamp":"2026-10-12T00:00:00.000Z"},"error":null,"requestId":"<UUID>"}
```

Ready thành công thêm `database: "up"`; khi DB lỗi trả `data: null`, `error.code: "DATABASE_UNAVAILABLE"`. Đây là kết quả ping DB, chưa chứng minh mọi bảng nghiệp vụ đã migrate.

## Auth trong 004

| Method / path | Quyền / input | Kết quả |
|---|---|---|
| POST /auth/login | Origin chính xác, JSON email/password strict | 200 identity/role/CSRF/expiry + HttpOnly cookie; 400 input, 401 credentials/MFA, 429 budget |
| GET /auth/me | Session | 200 user/CSRF/sessionExpiresAt, không token/hash/password |
| GET /auth/sessions | Session | 200 tối đa 100 session của chính user: id/createdAt/expiresAt |
| POST /auth/refresh | Session + Origin + JSON + X-CSRF-Token | 200 token cookie/CSRF mới, token cũ bị thu hồi |
| POST /auth/logout | Session + Origin + JSON + X-CSRF-Token | 200 loggedOut=true, thu hồi session và clear cookie |
| POST /auth/revoke-all | Session + Origin + JSON + X-CSRF-Token | 200 revoked=true, thu hồi mọi session của user và clear cookie |
| GET /admin/audit-logs | OWNER | 200 tối đa 100 audit mới nhất; ADMIN/VIEWER 403 |
| /agent/* | Device auth riêng chưa triển khai | 401 DEVICE_AUTH_REQUIRED dù có cookie admin |

Login input không nhận role hoặc field dư. Mutation không có Origin/CSRF hợp lệ trả 403; không JSON trả 415. Auth DB chưa cấu hình trả 503 AUTH_UNAVAILABLE; DB query lỗi trả lỗi 500 an toàn. Cookie tên automation_session; Secure chỉ khi backend production. Response không cache. Frontend cung cấp proxy cùng origin `/api/v1/auth/{action}` cho sáu action auth, không proxy audit hoặc URL tùy ý. Không có HTTP bootstrap/signup/password-reset.

Chi tiết chính sách và MFA tại [AUTH](AUTH.md). Devices/workflow/runs/provider/socket trong `PROJECT_CONTEXT.md` vẫn là thiết kế mục tiêu.
