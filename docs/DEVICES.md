# Windows Agent pairing và heartbeat

## Cách dùng

Owner đăng nhập, mở `/devices`, chọn **Tạo mã ghép đôi**. Mã `pair_…` dùng đúng một lần và hết hạn sau 5 phút. Mã chỉ hiển thị trong response và bộ nhớ UI; không đưa vào argument/env/log. Owner có thể ẩn mã; ẩn giao diện không thu hồi mã còn hiệu lực. Tối đa 5 mã/owner/15 phút và 10 lần pair/IP/15 phút, counter lưu PostgreSQL.

Trên máy Windows, cấu hình URL API trong `agent-windows/.env` theo mẫu. HTTPS bắt buộc, chỉ loopback HTTP local được bật rõ bằng AGENT_ALLOW_LOCAL_HTTP=true. Không tắt xác minh TLS; NODE_TLS_REJECT_UNAUTHORIZED=0 bị từ chối.

```powershell
pnpm --filter @automation/agent-windows pair
# Nhập tên thiết bị, rồi mã ghép đôi ở ô nhập ẩn.
pnpm build
pnpm --filter @automation/agent-windows start
```

`diagnose` vẫn chỉ kiểm tra health. `heartbeat` gửi một heartbeat rồi thoát; `rotate` xoay credential rồi thoát. `start` chạy vòng lặp outbound, không mở listener, inbound port, remote shell hoặc chạy nội dung tải về. Job claim/result thuộc 006, chưa có chức năng thực thi job.

```powershell
pnpm --filter @automation/agent-windows heartbeat
pnpm --filter @automation/agent-windows rotate
```

Owner thu hồi thiết bị tại `/devices`; các credential active/pending đều bị thu hồi. Agent dừng khi gặp auth rejection, không tự pair lại. Re-pair tạo identity mới: sau khi revoke và dừng Agent, lưu trữ/xóa đúng kho credential cũ theo quy trình cá nhân rồi chạy pair bằng mã mới. Không tự xóa dữ liệu local khi API báo lỗi.

## Credential và lưu trữ Windows

Token riêng có prefix agt_, random 256 bit, TTL 24 giờ. Scopes cố định `agent:heartbeat`, `agent:rotate`; chưa cấp claim/result/admin/Meta/storage. PostgreSQL chỉ lưu hash SHA-256 domain-separated. Cookie admin và bearer device không thay thế cho nhau; endpoint native từ chối request có Origin để không dùng trực tiếp từ browser.

Kho mặc định `%LOCALAPPDATA%/AutomationControl/device-identity/credential.dpapi`; có thể đặt AGENT_STATE_DIR là đường dẫn tuyệt đối tới thư mục dữ liệu của ứng dụng. Agent chỉ dùng subfolder device-identity. Không đặt vào env token, device ID hoặc JSON credential rõ. DPAPI CurrentUser mã hóa toàn bộ token/identity/API URL; DACL của thư mục chỉ cấp CurrentUser và SYSTEM, không thay owner hoặc xin elevation. Chạy Agent bằng chính Windows identity đã pair, với user profile khả dụng. Đổi tài khoản/service identity hoặc di chuyển ciphertext sang máy khác có thể làm credential không giải mã được; cần revoke/pair lại, không fallback plaintext hoặc LocalMachine.

Helper PowerShell là mã cố định đóng gói trong Agent, chạy executable hệ thống với NoProfile/NonInteractive và cửa sổ ẩn. Secret chỉ qua stdin/stdout pipe nội bộ, không qua command line, env hoặc console. Không nhận script/path/expression từ API. Ghi ciphertext qua file tạm + fsync + atomic rename. OS FileShare.None lock ngăn hai tiến trình ghi cùng kho, tự nhả khi tiến trình/helper đóng; không dùng lock PID stale. Symlink/junction của subfolder, file không bình thường, file quá lớn hoặc ciphertext hỏng bị từ chối.

DPAPI không bảo vệ khỏi malware chạy cùng Windows identity hoặc người quản trị đã chiếm máy. DACL/CurrentUser được test trong phiên hiện tại; chưa test multi-user/domain recovery hoặc Windows Service. Cài đặt service least privilege/reboot thuộc hardening/deployment, không tự sửa service, firewall hay power settings trong 005.

## Online/offline và reconnect

Server ghi lastSeenAt bằng thời gian server; không nhận client timestamp, online state hoặc metrics tùy ý. Heartbeat 30 giây; ONLINE nếu credential active chưa hết hạn, thiết bị chưa revoke và heartbeat mới hơn 90 giây. OFFLINE là giá trị suy ra khi đọc, không cần cron hoặc socket. Pair xong nhưng chưa heartbeat là OFFLINE; REVOKED ưu tiên hơn ONLINE/OFFLINE. UI poll 15 giây và lấy tối đa 100 thiết bị mới nhất.

Lỗi mạng/5xx/429 dùng exponential backoff có jitter, khoảng khởi đầu 0,75–1,25 giây, trần có jitter 75 giây. Thành công reset backoff. 401/403/409 dừng và yêu cầu xử lý identity; không dùng token user hay tự retry pair. Redirect upstream bị từ chối; timeout mặc định 5 giây và response tối đa 64 KiB. Log chỉ event/deviceId/delay hoặc thông báo an toàn, không body/token/code.

## Rotate phục hồi khi mất response

Agent tự rotate khi credential còn dưới 6 giờ; CLI rotate có thể chủ động chạy sớm. Credential phải còn hạn để bắt đầu/commit rotation; offline vượt 24 giờ mà không có credential mới đã active thì cần pair lại.

1. Agent tạo token mới bằng crypto.randomBytes, lưu pendingToken trong DPAPI **trước** khi thay đổi server.
2. POST `/agent/credentials/rotate` bằng token cũ, gửi token mới. Server chỉ lưu hash, scopes kế thừa, pending TTL 5 phút; token pending chưa dùng được cho heartbeat. Retry cùng candidate idempotent, candidate khác trả 409.
3. POST `/agent/credentials/commit` bằng token mới. Transaction khóa theo device, activate mới + revoke cũ + audit atomically. Retry commit sau khi response mất trả identity hiện hành mà không tạo credential/audit mới.
4. Agent promote token trong kho DPAPI. Nếu process dừng hoặc ghi cuối thất bại, pendingToken còn trong ciphertext để lần chạy sau recover. Nếu old đã revoke, stage trả 401 nhưng commit token mới vẫn hoàn tất idempotently. Revoke owner luôn thắng khi các transaction kết thúc; không activate lại thiết bị revoked.

Pending hết 5 phút có thể được stage lại bởi token cũ còn hiệu lực; không kéo dài token cũ. Client tạo token ngẫu nhiên mới và giữ đúng candidate khi retry; schema không thể tự đo entropy token do client cung cấp. Mất response pair hoặc không ghi được DPAPI sau pair có thể để lại device chưa dùng: owner phải revoke rồi phát mã khác. Không blind retry mã đã dùng.

## Kiểm thử Windows 11 còn thiếu

Môi trường hiện tại là Windows 10 Pro build 19045. DPAPI, native CLI, process restart, API outage/reconnect, rotate/revoke, frontend owner proxy và log đã được kiểm tra thực tại đây; không gọi đó là Win11 PASS. Prompt 005 giữ PARTIAL trong processing đến khi test trên Windows 11 đạt.

Trên **Windows 11**, dùng DB test riêng đã migrate, không có user/device hoặc dữ liệu thật:

```powershell
pnpm install --frozen-lockfile
pnpm build
# DATABASE_URL và SMOKE_DATABASE_URL trỏ tới cùng DB test riêng, do bạn cấu hình trong process.
pnpm db:migrate
pnpm agent:smoke
```

Script kiểm tra workstation build >=22000, tạo owner/device tạm, khởi động API/frontend ở loopback port riêng, chạy native Agent/DPAPI, outage/reconnect/revoke, kiểm tra log và dọn đúng fixtures/ciphertext của nó. Không sửa .env hoặc reset DB. `--allow-windows-10` chỉ dành cho test tương thích, không đạt gate Win11. Counter IP trong DB test riêng được dọn để chạy lại; không dùng script trên DB runtime/shared. CI thêm job Windows để test DPAPI; hosted Windows runner có thể là Windows Server và không thay bằng chứng Win11, CI remote chưa chạy trong phiên này.

## Nguồn

- [Microsoft DPAPI/.NET](https://learn.microsoft.com/en-us/dotnet/standard/security/how-to-use-data-protection): Protect/Unprotect theo CurrentUser.
- [Microsoft CryptProtectData](https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata): ràng buộc user/máy và DPAPI.
- [ADR 002](ADR/002-device-identity.md): credential scoped, DPAPI và rotation hai bước.
