---
id: "024"
title: "MeshCentral adapter tùy chọn"
status: PLANNED
depends_on: ["022"]
baseline_task: "CORE-04"
---

# 024 — Desktop sau core

Chỉ thực hiện khi chủ dự án muốn remote desktop và cung cấp môi trường. Kiểm tra tài liệu/source MeshCentral phiên bản pin, không giả định REST endpoint. Tách runnerStatus, meshStatus và server reachability. Không đưa credential admin xuống FE. Chứng minh enforce lease và chặn truy cập trực tiếp bypass trước khi tuyên bố độc quyền desktop.

- [ ] Mapping thiết bị và trạng thái từ adapter thật.
- [ ] Desktop session qua policy/ACK/lease, revoke và các đường bypass được kiểm thử.
- [ ] Docs deploy/security/test thật; nếu thiếu môi trường giữ PARTIAL.
