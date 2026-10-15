# Auth và quyền

- `pnpm owner:bootstrap`: tạo OWNER hệ thống duy nhất qua terminal; `pnpm user:create`: tạo user để chia sẻ máy. Password nhập ẩn, 12–128 ký tự, tối đa 128 byte UTF-8. Không có signup/reset password HTTP.
- Password hash scrypt; session opaque 256-bit, DB chỉ lưu hash. Cookie HttpOnly, SameSite=Strict, Secure khi production.
- Session TTL 30 phút, gia hạn tối đa 8 giờ từ login. GET không gia hạn. Refresh xoay cookie/CSRF; logout/revoke-all thu hồi tại DB.
- Mutation: Origin đúng + JSON + CSRF gắn session (login không cần CSRF). Next chỉ proxy path/method allowlist, không cache dữ liệu riêng tư.
- Mỗi request đọc trạng thái/quyền user từ DB. User DISABLED hoặc bật MFA chưa có handler đều bị từ chối.
- Quyền máy tách khỏi role hệ thống: owner/member mới được xem; chỉ owner device chia sẻ/thu hồi. VIEWER/OPERATOR hiện chỉ xem.
- Throttle durable 15 phút: 5 login/email, 30 login/IP; tính cả thành công. Qua proxy có thể dùng chung IP; core dành cho số ít user/máy.
- Chưa có MFA, password recovery hoặc UI quản lý user. Không bật `mfaEnabled` thủ công.

Lựa chọn kỹ thuật: [ADR 001](ADR/001-admin-sessions.md). Credential Agent: [DEVICES](DEVICES.md). Endpoints: [API](API.md).
