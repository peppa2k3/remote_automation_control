# Bổ sung core 021

Ownership/membership của device được kiểm tra server-side; owner hệ thống không có quyền ngầm với máy khác. Mã pairing mới có entropy 256-bit, Agent yêu cầu xác nhận URL server tại local; device token vẫn hash trong DB, DPAPI CurrentUser tại Windows. Uptime/RAM/hostname chỉ có owner/member xem; không thu thập danh sách tiến trình/file. Unknown khi FE mất server không đồng nghĩa thiết bị tắt. Mẫu VPS có cookie Secure/HTTPS và không publish DB/API trực tiếp. Chưa có lease/executor/desktop; không mô tả operator có quyền chạy lệnh. Source starter không nằm trong runtime/build context.

# Bảo mật

Health vẫn công khai; các route nhạy cảm yêu cầu session và quyền server-side. Chưa có endpoint tạo job/publish; không coi health công khai là cơ chế đăng nhập. Public health không trả connection string, stack trace hay provider secret. `requestId` do server sinh; log chỉ method/path/status/duration, không query/body/token.

Request có body giới hạn 32 KB; CORS chỉ origin cấu hình; Helmet, rate limit, tắt X-Powered-By. Prompt 004 đã thêm session hash server-side, scrypt, HttpOnly/SameSite/Secure production, Origin + CSRF, RBAC, durable brute-force limits và audit. [AUTH](AUTH.md) mô tả chính sách, giới hạn proxy, review và kế hoạch MFA; MFA chưa triển khai. Không log password/session/CSRF. Owner bootstrap không nhận password trong argument/env; Agent không dùng cookie admin.

Dev Compose có project/volume riêng, port bind loopback. Không cấu hình Traefik/MinIO production trước khi kiểm tra thông tin thực. Không mount Docker socket hay toàn bộ ổ đĩa Windows.

Downloader tương lai phải kiểm tra DNS + mỗi redirect, pin public IP để chống DNS rebinding, chặn metadata/private/link-local/reserved, byte quota và path traversal. Agent không execute nội dung tải về.

Meta spike không được chạy publish nếu thiếu Page/quyền cụ thể. Publish thực dùng token mã hóa server-side, fingerprint durable, rate policy và reconciliation khi trạng thái chưa biết. Agent không nhận token Meta.

005 cấp device credential riêng chỉ heartbeat/rotate, server hash-only; pair code random TTL 5 phút/dùng một lần, durable budgets; cookie admin không dùng cho Agent. DPAPI CurrentUser + DACL bảo vệ ciphertext, không plaintext fallback; helper mã cố định qua pipe, không nhận generic command. Rotate hai bước có local pending token trước server change và commit idempotent; revoke/rotation serialized SQL. HTTPS/TLS verification, không theo redirect, timeout/response limit và log không token/code. [DEVICES](DEVICES.md) ghi rõ limits và gate Win11 chưa đạt; native Windows 10 đã kiểm tra thật, không thay đổi firewall/service hoặc hạ tầng ngoài local.
