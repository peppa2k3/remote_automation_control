# API core

Base `/api/v1`; response `{ success, data, error, requestId }`, header `X-Request-Id`. Schema/DTO tại `packages/contracts/`.

## Browser — qua Next cùng origin

| Method/path | Quyền và kết quả |
|---|---|
| POST `/auth/login` | Email/password; cấp session cookie + CSRF |
| GET `/auth/me`, `/auth/sessions` | Session hiện tại / danh sách session của user |
| POST `/auth/refresh` | Gia hạn, xoay cookie/CSRF |
| POST `/auth/logout`, `/auth/revoke-all` | Thu hồi session hiện tại / tất cả session của user |
| GET `/devices` | User đăng nhập; tối đa 100 máy sở hữu/được chia sẻ |
| POST `/devices/pairing-code` | User đăng nhập; mã một lần, TTL 5 phút |
| GET `/devices/:id/activity` | Owner/member; 50 sự kiện gần nhất |
| GET `/devices/:id/members` | Owner device; danh sách thành viên |
| POST `/devices/:id/members` | Owner device; `{ email, role: VIEWER hoặc OPERATOR }` |
| POST `/devices/:id/members/remove` | Owner device; `{ userId }` |
| POST `/devices/:id/revoke` | Owner device; `{}`, thu hồi credential |

Mutation yêu cầu Origin chính xác + JSON; trừ login còn cần `X-CSRF-Token`. Global OWNER không bypass quyền device. `/admin/audit-logs` chỉ OWNER hệ thống tại backend nội bộ, không được Next proxy công khai.

## Agent — trực tiếp tới API

| POST path | Xác thực/input |
|---|---|
| `/agent/pair` | Code + label + metadata; trả credential một lần |
| `/agent/heartbeat` | Bearer device; metadata/runtime, trả nhịp 5 giây |
| `/agent/credentials/rotate` | Bearer cũ; `{ token: candidate }` |
| `/agent/credentials/commit` | Bearer candidate; `{}` |

Native routes từ chối Origin; cookie user không thay bearer device. Runtime gồm hostname, uptime, RAM và CPU count, được validate strict. Không có endpoint chạy lệnh/job.

## Health/lỗi

`GET /health/live`: tiến trình sống. `GET /health/ready`: DB up 200/down 503; không kiểm chứng migration. Các lỗi chính: 400 input, 401 auth, 403 quyền/Origin/CSRF, 404 route/device, 429 rate limit. Không trả token/hash/stack trace trong lỗi.
