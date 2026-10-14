# ADR 003 — Chuyển sang core quản lý thiết bị từng bước

Ngày: 14/10/2026. Nguồn yêu cầu: tích hợp `remote-control-agent-core-base` vào dự án hiện tại, ưu tiên người mới và hoàn thiện kết nối/giám sát trước.

Giữ Next.js/Express/Prisma/PostgreSQL, cookie session/CSRF, pairing, DPAPI và credential rotation đã có. Tiếp nhận ownership theo từng device, membership nhiều-nhiều, presence tách khỏi khả năng desktop, và UI unknown khi không tới server. Dùng HTTP heartbeat/poll 5 giây cho core đầu tiên; đây là lựa chọn triển khai đơn giản, không phải bản Socket.IO/lease hoàn chỉnh của starter.

Một owner hệ thống vẫn tồn tại để bootstrap tài khoản; owner của từng device là người tạo mã pair. Không có quyền ngầm truy cập device của người khác từ role toàn hệ thống. Dữ liệu cũ được backfill owner từ owner hệ thống hiện tại. Member viewer/operator mới có quyền xem ở bước này; operator chưa có chức năng chạy lệnh. Session điều khiển pending/ACK, takeover và MeshCentral được lập prompt sau, trước khi cung cấp bất kỳ thao tác điều khiển nào.

Triển khai VPS dùng cùng code/DB; một domain HTTPS định tuyến browser tới Next và native Agent tới API. Mẫu Caddy độc lập dành cho VPS còn trống cổng 80/443; VPS có proxy sẵn cần nối vào proxy hiện hữu. Không tự triển khai lên hạ tầng thật. Source starter giữ nguyên làm tham chiếu và được loại khỏi workspace build/lint/Docker context.
