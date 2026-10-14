# Lộ trình học và phát triển mới

Theo yêu cầu 14/10/2026, ưu tiên kết nối và quản lý thiết bị trước tự động hóa. Giữ các prompt/lịch sử cũ để truy nguyên; không chạy tuần tự backlog tải file/publish chỉ vì số thứ tự nhỏ hơn.

| Bước | Làm được gì | Gate trước bước tiếp |
|---|---|---|
| 01 — prompt 021 | Login, pair, owner/member, heartbeat, thông tin máy, activity, hướng dẫn local/VPS | Test local đạt; tự nghiệm thu VPS thật theo guide |
| 02 — prompt 022 | Phiên điều khiển độc quyền pending → local ACK → active, renew/timeout/revoke | Hai browser tranh chấp, nonce replay, disconnect/logout/restart đều fail closed |
| 03 — prompt 023 | Script local allowlist rất nhỏ, ví dụ tác vụ kiểm tra của chính bạn | Không shell từ web; params schema, timeout/cancel, fencing với lease |
| 04 — prompt 024 | MeshCentral adapter nếu thật sự cần desktop | Xác minh API/version và chặn đường bypass lease trước khi tuyên bố độc quyền desktop |
| 05 — backlog nâng cao | Queue bền vững, tải file, media, workflow, provider, AI | Chỉ chọn từng prompt khi core phù hợp và provider được cấp quyền |

Windows 11 thực tế của 005 vẫn cần kiểm chứng riêng. Linux Agent của starter chưa được nhập: kho DPAPI hiện dành cho Windows. Bản đầu không có Windows Service, Socket.IO, lease, MeshCentral adapter hoặc script executor. Operator được lưu như role tương lai; hiện chỉ có quyền xem. Snapshot web lấy qua REST mỗi 5 giây; không gọi đây là realtime WebSocket.

## Bản đồ chuyển logic

| Starter `remote-control-agent-core-base` | Dự án hiện tại |
|---|---|
| React/Vite | Giữ Next.js với session server-side và proxy |
| SQLite single-process | Giữ PostgreSQL/Prisma và migration bổ sung |
| Cookie login | Giữ session hash, CSRF, throttle đã có |
| Enrollment + console consent | Pair code 256-bit + xác nhận URL; giữ credential rotation/DPAPI |
| Owner + members | `devices.ownerId`, `device_members`, API/UI chia sẻ |
| Socket presence/snapshot | Core REST heartbeat/poll 5s; offline 25s, unknown khi mất server |
| Lease/nonce/ACK/takeover | Prompt 022 trước mọi điều khiển |
| MeshCentral/script runner | Prompt 023/024, không nhập executor hoặc bịa API |

Source tham khảo giữ nguyên và không nằm trong pnpm workspace/build/lint/Docker context.
