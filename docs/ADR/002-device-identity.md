# ADR 002 — Device identity và rotation hai bước

Ngày: 2026-10-13. Trạng thái: Accepted cho triển khai 005; gate Windows 11 còn pending.

## Bối cảnh

Agent Windows native chỉ kết nối outbound. Admin session không được dùng để heartbeat hoặc nhận job. Restart/mất mạng không được làm mất credential; PostgreSQL giữ identity và trạng thái thu hồi.

## Quyết định

Pair bằng mã random 128 bit, TTL 5 phút, consume-once trong SQL transaction. Credential opaque random 256 bit, TTL 24 giờ, prefix riêng, server chỉ lưu hash, scope chỉ heartbeat/rotate tại 005. Không thêm signing secret hoặc cấp claim/result trước prompt queue.

Lưu ciphertext DPAPI CurrentUser với DACL CurrentUser/SYSTEM và OS exclusive file lock; không dùng credential rõ trong env, JSON hoặc plaintext fallback. Helper PowerShell chỉ chạy mã cố định qua pipe, không là kênh thực thi lệnh từ backend.

Rotation stage/commit: candidate được ghi DPAPI trước network; server stage hash, activate/revoke dưới khóa device, commit idempotent. Chọn candidate phía Agent để có thể phục hồi sau lost response mà server không phải giữ hoặc trả lại token rõ. Scopes chỉ kế thừa, không nhận từ client. UI tính online dựa lastSeenAt server + TTL; không thêm socket trước 007.

## Hệ quả

Mất response pair cần owner revoke/pair lại; rotate có thể phục hồi bằng pendingToken. DPAPI cần cùng identity và profile Windows; không chuyển sang LocalMachine để né lỗi. Offline quá credential TTL cần pair lại. Retention, service install/reboot, trusted proxy và multi-user/domain tests thuộc vận hành tiếp theo. Chi tiết và gate Win11 tại [DEVICES](../DEVICES.md).
