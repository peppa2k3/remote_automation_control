---
id: "023"
title: "Một tác vụ local allowlist đầu tiên"
status: PLANNED
depends_on: ["022"]
baseline_task: "CORE-03"
---

# 023 — Runner cơ bản

Chọn một tác vụ nhỏ theo yêu cầu người dùng, có scriptId và schema params cố định. Chỉ chạy khi lease active đã ACK, device/user/browser đúng, thời hạn còn hiệu lực. Không nhận shell/code/path tùy ý từ web. Timeout/output cap/concurrency=1, cancellation và fencing ngăn phiên cũ tiếp tục sau takeover. Thiết kế idempotency trước side effect; nếu cần queue thực hiện 006 với dependencies/gate phù hợp.

- [ ] Một tác vụ được cho phép chạy và trả kết quả thật.
- [ ] Sai quyền/params/lease/timeout/revoke bị chặn hoặc dừng an toàn.
- [ ] Unit/integration/build và guide từng bước; không tự chạy script bên ngoài repo.
