# ADR 001 — Session quản trị lưu PostgreSQL

Ngày: 2026-10-13. Trạng thái: Accepted trong prompt 004.

## Bối cảnh

MVP cần owner bootstrap, revoke tức thời, role/status mới nhất và audit, trên Express/Next.js/PostgreSQL hiện hữu. Device phải có định danh riêng. Không thêm Redis, dịch vụ auth bên ngoài hoặc dependency crypto mới.

## Quyết định

Dùng session opaque random 256 bit, token gốc chỉ ở HttpOnly cookie, hash SHA-256 domain-separated ở DB. Native scrypt với salt riêng cho password. Next.js cung cấp proxy auth cùng origin và xác minh session server-side cho dashboard; Express vẫn quyết định quyền. CSRF HMAC gắn session và Origin chính xác trên mutation. PostgreSQL transaction/advisory locks bảo vệ bootstrap, durable throttle và session rotation/revoke.

Không dùng JWT chứa role để tránh quyền cũ và nhu cầu blacklist revoke. Không dùng password/session secret chung: entropy đến từ crypto.randomBytes; CSRF được dẫn xuất từ token ngẫu nhiên. Encryption key cho MFA/provider là nhu cầu riêng trong prompt triển khai tương ứng.

## Hệ quả

Mỗi request cần DB; DB lỗi thì auth từ chối. Cần retention/index monitoring cho sessions, throttles và audit. BFF chia sẻ IP budget đến khi có trusted proxy policy được kiểm thử. MFA chưa thực hiện, mfaEnabled=true fail closed. Chi tiết tham số, quyền và kế hoạch tại [AUTH](../AUTH.md).
