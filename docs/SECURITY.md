# Bảo mật

Bootstrap chỉ expose health. Chưa có endpoint tạo job/publish; không coi health công khai là cơ chế đăng nhập. Public health không trả connection string, stack trace hay provider secret. `requestId` do server sinh; log chỉ method/path/status/duration, không query/body/token.

Request có body giới hạn 32 KB; CORS chỉ origin cấu hình; Helmet, rate limit, tắt X-Powered-By. Cookie/session, CSRF, MFA, RBAC và audit hành động nhạy cảm nằm ở prompt 004 trước mọi endpoint nghiệp vụ.

Dev Compose có project/volume riêng, port bind loopback. Không cấu hình Traefik/MinIO production trước khi kiểm tra thông tin thực. Không mount Docker socket hay toàn bộ ổ đĩa Windows.

Downloader tương lai phải kiểm tra DNS + mỗi redirect, pin public IP để chống DNS rebinding, chặn metadata/private/link-local/reserved, byte quota và path traversal. Agent không execute nội dung tải về.

Meta spike không được chạy publish nếu thiếu Page/quyền cụ thể. Publish thực dùng token mã hóa server-side, fingerprint durable, rate policy và reconciliation khi trạng thái chưa biết. Agent không nhận token Meta.
