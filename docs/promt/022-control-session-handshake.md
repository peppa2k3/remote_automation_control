---
id: "022"
title: "Phiên điều khiển độc quyền có local ACK"
status: PLANNED
depends_on: ["021"]
baseline_task: "CORE-02"
---

# 022 — Session handshake

Đọc ADR 003, CORE_ROADMAP và logic starter. Giữ core đã có. Triển khai pending 20s giữ chỗ, active 45s, renew 10s; bind user + auth session + browser connection + device. Chỉ device đã xác thực được ACK nonce còn hạn; owner takeover revoke cũ trước, owner vẫn cần ACK; operator không force, viewer không yêu cầu control. Auto-approve mặc định tắt. Lưu quyền/lease bằng PostgreSQL transaction, không copy SQLite.

- [ ] Mọi disconnect/logout/revoke/expiry/restart/downgrade fail closed.
- [ ] Hai browser đồng thời chỉ một pending/active, sai nonce/device/replay bị từ chối.
- [ ] UI/Agent có handshake, reconnect và snapshot được lọc quyền.
- [ ] Test thực hai browser + local; lint/typecheck/test/build; cập nhật API/docs/log.

Chưa cung cấp script executor/desktop ở prompt này. Chọn transport sau khi kiểm tra disconnect và deployment; Socket.IO nếu dùng phải xác thực và kiểm tra quyền lại mỗi thao tác.
