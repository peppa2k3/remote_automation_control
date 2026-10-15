# Bảo mật core

- User session và device credential riêng; kiểm tra quyền tại backend. OWNER hệ thống không bypass device ownership.
- Password scrypt; session/code/token chỉ lưu hash trong DB. Credential Windows dùng DPAPI CurrentUser, không plaintext fallback.
- Browser mutation yêu cầu Origin + JSON + CSRF. Next proxy allowlist; API có validation, body limit 32 KB, throttle và log an toàn.
- VPS bắt buộc HTTPS, cookie Secure, DB private. Agent chỉ outbound; không theo redirect hoặc tắt TLS verification.
- Không shell/eval, thực thi file tải về, nhận lệnh tùy ý, scan file/process hoặc public cổng Agent.
- Không commit/log password, pair code, bearer, cookie hoặc `.env` thật. Không reset DB, xóa volume hoặc sửa tài nguyên dùng chung.
- Core hiện chỉ giám sát, chưa có MFA/Windows Service/kiểm chứng VPS thật. Mở rộng theo prompt, xác minh API bên thứ ba khi triển khai.

Chi tiết: [AUTH](AUTH.md), [DEVICES](DEVICES.md), [API](API.md).
