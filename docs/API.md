# API hiện tại

## Core device manager (021)

Quyền device theo ownerId/member, không theo role OWNER toàn hệ thống. Mọi user đăng nhập được list máy của mình/được chia sẻ và tạo mã pair cho máy mình. Pair tạo code 256-bit (vẫn nhận code cũ 128-bit còn hạn trong rollout). Các mutation browser vẫn yêu cầu Origin + CSRF + JSON. Native Agent dùng bearer riêng.

| Method / path sau `/api/v1` | Quyền | Kết quả |
|---|---|---|
| GET /devices | User đăng nhập | Snapshot tối đa 100 máy thuộc quyền, role OWNER/OPERATOR/VIEWER, runtime nullable, meshStatus NOT_INTEGRATED |
| POST /devices/pairing-code | User đăng nhập | Mã 5 phút một lần; người tạo mã thành owner device |
| POST /devices/:id/revoke | Owner của device | Revoke device và credentials |
| GET /devices/:id/activity | Owner/member | 50 sự kiện mới nhất: id, action, createdAt; không secret |
| GET /devices/:id/members | Owner của device | userId, email, role |
| POST /devices/:id/members | Owner + `{email, role: OPERATOR hoặc VIEWER}` | Thêm/cập nhật quyền tài khoản đã tạo |
| POST /devices/:id/members/remove | Owner + `{userId}` | Gỡ quyền, lần đọc tiếp theo không thấy máy |

Heartbeat nhận metadata cũ và `runtime` tùy chọn: hostname, uptimeSeconds, agentUptimeSeconds, memoryTotalBytes, memoryFreeBytes, cpuCount. Runtime strict, số không âm, free <= total; không nhận command/path. Server trả heartbeatAfterSeconds=5. ONLINE cần credential còn hạn và heartbeat sau lần khởi động API hiện tại, mới hơn 25 giây. FE không tới API là UNKNOWN ở client, không ghi trạng thái này vào DB. Bảng 005 dưới đây mô tả lịch sử endpoint; quyền list/pair/revoke được thay bởi bảng 021 này.

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
| /agent/* | Device auth riêng | Cookie admin không được thay bearer device; endpoint chưa triển khai 404 với credential hợp lệ |

Login input không nhận role hoặc field dư. Mutation không có Origin/CSRF hợp lệ trả 403; không JSON trả 415. Auth DB chưa cấu hình trả 503 AUTH_UNAVAILABLE; DB query lỗi trả lỗi 500 an toàn. Cookie tên automation_session; Secure chỉ khi backend production. Response không cache. Frontend cung cấp proxy cùng origin `/api/v1/auth/{action}` cho sáu action auth, không proxy audit hoặc URL tùy ý. Không có HTTP bootstrap/signup/password-reset.

Chi tiết chính sách và MFA tại [AUTH](AUTH.md). Workflow/runs/provider/socket trong `PROJECT_CONTEXT.md` vẫn là thiết kế mục tiêu.

## Thiết bị trong 005

| Method / path | Quyền / input | Kết quả |
|---|---|---|
| GET /devices | Session OWNER | Tối đa 100 device, lastSeen/onlineState/fingerprint 12 hex; không token/hash đầy đủ |
| POST /devices/pairing-code | OWNER + CSRF/Origin + JSON {} | code một lần/expiry; 429 mint budget |
| POST /devices/:deviceId/revoke | OWNER + CSRF/Origin + JSON {} | Thu hồi device và mọi credential, idempotent; UUID validation/404 |
| POST /agent/pair | Không cookie; JSON code/label/platform/arch/version/capabilities | identity/scopes/token/credentialExpiresAt trả một lần; 401 mã sai/dùng/hết hạn, 429 IP budget |
| POST /agent/heartbeat | Bearer agt_… scope agent:heartbeat; JSON metadata | deviceId/serverTime/heartbeatAfterSeconds; 401 revoked/expired/pending, 403 scope |
| POST /agent/credentials/rotate | Bearer cũ scope agent:rotate; JSON {token: candidate} | Stage identity/expiry, không trả token; 409 conflict |
| POST /agent/credentials/commit | Bearer candidate scope agent:rotate; JSON {} | Activate mới/revoke cũ atomically; retry idempotent |

Native routes từ chối request có Origin; cookie user không cấp quyền. Metadata strict: platform win32, arch x64/arm64, semver ba phần, capabilities diagnostics/heartbeat không trùng. Không nhận scopes/onlineState/client timestamp/command tùy ý. Frontend `/api/v1/devices/...` chỉ proxy GET list và POST pairing-code/revoke-UUID; không proxy agent endpoints. [DEVICES](DEVICES.md) mô tả policy/DPAPI/rotation và gate Win11 còn pending.
