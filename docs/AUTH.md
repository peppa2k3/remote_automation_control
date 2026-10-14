# Quyền device trong core 021

Session/CSRF/throttle tiếp tục theo auth 004 bên dưới. Quyền toàn hệ thống không thay thế quyền máy: user đăng nhập có thể tạo mã pair và sở hữu nhiều máy; một device có một owner cùng các member VIEWER/OPERATOR. Chỉ owner device quản lý members/revoke. `pnpm user:create` tạo tài khoản global VIEWER qua terminal server với mật khẩu ẩn; không có signup công khai. Operator hiện chỉ xem, điều khiển cần prompt 022. Xem [CORE_ROADMAP](CORE_ROADMAP.md).

# Đăng nhập quản trị và kế hoạch MFA

## Phần đã triển khai trong 004

Email/password được validate bằng Zod; email chuẩn hóa lowercase, password không trim. Password bootstrap dài 12–128 ký tự và tối đa 128 byte UTF-8. Node.js scrypt dùng salt ngẫu nhiên 16 byte, N=32768, r=8, p=3, key 64 byte; so sánh constant-time. Giới hạn hai tác vụ hash đồng thời và mười tác vụ chờ để kiểm soát bộ nhớ.

Owner chỉ tạo qua CLI tương tác, password nhập ẩn và xác nhận hai lần. Không nhận password qua argument, env, HTTP signup hoặc log. Transaction khóa bootstrap và partial unique index đảm bảo tối đa một OWNER, kể cả thao tác đồng thời; không ghi đè owner hiện hữu. CLI không cung cấp reset password hoặc tạo tài khoản khác trong prompt này.

Session opaque ngẫu nhiên 256 bit; cookie `automation_session` giữ token gốc, PostgreSQL chỉ lưu SHA-256 có domain separation. Cookie host-only, Path=/, HttpOnly, SameSite=Strict; Secure khi backend NODE_ENV=production. Local Compose HTTP dùng development và không bật Secure. Không lưu token trong JSON, localStorage hoặc log.

Session hết hạn sau 30 phút nếu không refresh; refresh xoay token và CSRF token, thu hồi token cũ atomically, không vượt giới hạn tuyệt đối tám giờ kể từ login. Đây là TTL theo lần phát hành, không tự gia hạn khi GET. Logout thu hồi session hiện tại; revoke-all thu hồi mọi session của user. Các transaction create/refresh/revoke-all khóa theo user để refresh đang chạy không thoát thu hồi. Một login mới sau revoke-all vẫn được phép nếu credentials hợp lệ.

Mọi request xác thực đọc user/status/role mới nhất trong DB. DISABLED hoặc mfaEnabled=true bị từ chối; không dựa vào role từ client. OWNER đọc audit và qua được middleware mutation nghiệp vụ; ADMIN/VIEWER đọc identity/session và thao tác session của chính mình. Mutation nghiệp vụ mặc định chỉ OWNER đến khi prompt tương ứng định nghĩa quyền cụ thể. Chưa có API quản lý user/role hoặc route nghiệp vụ.

## CSRF, proxy và giới hạn đăng nhập

Mutation yêu cầu Origin trùng tuyệt đối origin cấu hình, Content-Type application/json; trừ login còn cần X-CSRF-Token, là HMAC gắn với session hiện tại. GET có Origin cũng phải khớp; Sec-Fetch-Site=cross-site bị chặn. Không coi CORS hoặc SameSite là kiểm tra CSRF duy nhất. Frontend gọi proxy cùng origin `/api/v1/auth/{action}`; proxy chỉ cho phép sáu action cố định, chỉ chuyển cookie session/CSRF hợp lệ và không theo redirect upstream. SSR kiểm tra session trước khi render dashboard; dữ liệu auth không cache offline.

Trong cửa sổ 15 phút: tối đa năm lần login cho mỗi email và ba mươi lần cho mỗi IP; cả login thành công và thất bại đều tính. Counter SHA-256 lưu PostgreSQL, cập nhật dưới advisory locks theo thứ tự cố định, không reset khi tiến trình restart. Lỗi credentials không phân biệt email không tồn tại, sai password hoặc disabled. Có thêm rate limit toàn API 120 request/phút/IP trong bộ nhớ, không thay thế counter durable. API hiện không trust X-Forwarded-For; qua BFF/reverse proxy, IP có thể là IP chung của proxy, nên IP budget được chia sẻ. Prompt deployment phải cấu hình trust proxy đúng số hop/allowlist và có test chống spoofing, không bật trust proxy tùy tiện.

Audit ghi action, actorId, targetId, requestId và thời gian; không body, email, password, cookie hay CSRF. Các sự kiện: owner.bootstrap, auth.login, auth.login.failed, auth.refresh, auth.logout, auth.revoke_all. Denial bởi middleware chưa có audit riêng; HTTP log có status và correlation. DB lỗi làm auth fail closed; lỗi API không trả stack trace hoặc connection URL.

## Kế hoạch MFA — chưa triển khai

Không bật mfaEnabled thủ công: login/session sẽ bị từ chối vì chưa có challenge handler. Phạm vi hiện tại chỉ hoàn thành kế hoạch MFA; chưa được xem là đáp ứng xác thực hai yếu tố hoặc production-ready.

1. Ưu tiên WebAuthn/passkey với RP ID/origin cấu hình, challenge một lần có TTL và counter/credential verification. TOTP là lựa chọn dự phòng nếu cần, với secret mã hóa server-side bằng key riêng, không gửi cho Agent.
2. Password hợp lệ chỉ tạo challenge ngắn hạn, chưa cấp admin session. Rate limit riêng cho challenge/TOTP, kiểm tra replay và transaction consume-once; cấp session sau factor thứ hai hợp lệ.
3. Enrollment/change/disable cần password + factor hiện tại hoặc quy trình recovery rõ ràng. Chỉ bật mfaEnabled sau khi xác minh enrollment; audit và revoke mọi session khi thay factor.
4. Recovery codes random, chỉ hiển thị một lần, lưu hash, dùng một lần atomically; không gửi qua log. Recovery owner phải có thủ tục vận hành có kiểm chứng, không thêm endpoint bypass MFA.
5. Test challenge hết hạn/dùng lại, Origin/RP mismatch, OTP lệch cửa sổ/replay, brute force, recovery concurrency, mất factor và session assurance. Chỉ triển khai production sau khi các gate này đạt.

## Giới hạn và việc tiếp theo

Chưa có reset/change password, màn hình danh sách session, user management, cleanup/retention định kỳ cho session/throttle/audit hoặc MFA thực. Session list API giới hạn 100 kết quả, không trả hash/token; audit list OWNER lấy 100 bản ghi mới nhất. Counter hết cửa sổ sẽ được reset khi dùng lại, nhưng key cũ vẫn tồn tại; cleanup/retention thuộc vận hành tiếp theo. Cookie không có tiền tố __Host-; production cần HTTPS trên host đáng tin cậy và kiểm thử cấu hình proxy tại prompt deployment. Admin cookie luôn bị từ chối tại `/api/v1/agent/*`; [device auth 005](DEVICES.md) dùng credential riêng, gate Win11 còn pending.

## Nguồn và quyết định

- [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html): tham số scrypt và salt.
- [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html): token gắn session và kiểm tra Origin.
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html): opaque session, cookie flags, expiry/revoke.
- [Node.js 24 crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html): scrypt, randomBytes và timingSafeEqual.
- [ADR 001](ADR/001-admin-sessions.md): lựa chọn session server-side và ranh giới device.
