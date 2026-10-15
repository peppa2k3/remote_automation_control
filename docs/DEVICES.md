# Windows Agent

Chạy lần đầu: [start-here](guides/start-here.md). Agent native Windows, outbound HTTP loopback local hoặc HTTPS VPS; không mở cổng vào máy.

## Lệnh tại root

| Lệnh | Việc thực hiện |
|---|---|
| `pnpm agent:diagnose` | Kiểm tra health server |
| `pnpm agent:pair` | Xác nhận URL, nhập YES, tên máy và mã ẩn |
| `pnpm agent:start` | Heartbeat/reconnect liên tục; Ctrl+C để dừng |
| `pnpm --filter @automation/agent-windows heartbeat` | Gửi một heartbeat |
| `pnpm --filter @automation/agent-windows rotate` | Xoay credential một lần |

Build trước `start`. Pair dùng mã 256-bit/5 phút/một lần; tối đa 5 mã/user và 10 lần pair/IP trong 15 phút. Pair xong chưa heartbeat thì thiết bị vẫn offline.

Heartbeat 5 giây, offline sau 25 giây; lỗi mạng/5xx/429 retry exponential backoff có jitter, trần 75 giây. Lỗi 401/403/409 thì dừng. API restart cần heartbeat mới. Web mất server báo unknown, không suy ra máy tắt.

## Credential/recovery

- Credential TTL 24 giờ, chỉ có scopes heartbeat/rotate; DB lưu hash. Agent tự rotate khi còn dưới 6 giờ, lưu pending token trước khi thay server và commit idempotent.
- Kho mặc định `%LOCALAPPDATA%/AutomationControl/device-identity/credential.dpapi`, DPAPI CurrentUser và DACL. `AGENT_STATE_DIR` là thư mục cha tùy chọn. Dùng đúng Windows user/máy đã pair; không chuyển sang SYSTEM hoặc lưu plaintext.
- Đổi URL server cần kho riêng và pair tại server mới. Offline quá hạn, bị revoke hoặc kho hỏng: dừng Agent, owner revoke device cũ, dùng một thư mục state mới rồi pair mã mới. Không xóa kho khi chỉ lỗi mạng.
- Pair mất response/lưu DPAPI thất bại: kiểm tra web, revoke device vừa tạo rồi dùng mã mới; không retry mù mã đã dùng.
- Owner device chia sẻ qua **Hoạt động và thành viên**; tài khoản nhận phải có trước (`pnpm user:create`). VIEWER/OPERATOR hiện chỉ xem.

Chưa có Windows Service/installer; giữ terminal Agent mở. Không có script/desktop/job runner.

## Kiểm chứng Windows 11

Gate 005 còn PARTIAL. Đã test native Windows 10; Windows 11 cần chạy lại trên **DB test riêng**, không dùng DB thật. Build, migrate DB test, đặt `DATABASE_URL` và `SMOKE_DATABASE_URL` cùng DB test rồi chạy `pnpm agent:smoke`.

Smoke tạo/dọn fixture riêng, kiểm tra DPAPI, restart, rotation, outage/reconnect, revoke và log không secret. `--allow-windows-10` chỉ kiểm tra tương thích, không thay gate Win11. Chi tiết thiết kế: [ADR 002](ADR/002-device-identity.md); env: [configuration](guides/configuration.md).
