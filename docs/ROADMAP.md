# Ưu tiên mới: core device manager

Từ 14/10/2026, làm theo [CORE_ROADMAP](CORE_ROADMAP.md) và các prompt 021–024. Bảng 001–020 bên dưới là backlog automation được giữ lại; 005 vẫn PARTIAL do gate Windows 11. Prompt 021 tích hợp giám sát và quyền thiết bị vào phần đã làm, không tuyên bố hoàn tất lease/ACK của starter.

# Roadmap và trạng thái prompt

Theo baseline T00–T17; đọc vị trí file để biết trạng thái hiện tại. ID là thứ tự nhận dạng, không bắt buộc thứ tự chạy tuyệt đối: **011 Meta feasibility cần chạy sớm ngay sau 004 auth** khi đã có quyền/Page; 005–010 có thể tiếp tục độc lập spike.

| ID | Baseline | Prompt | Dependencies |
|---|---|---|---|
| 001 | NONE | Phân tích, context rules và kiến trúc | — |
| 002 | T00 | Bootstrap monorepo và runtime nền tảng | 001 |
| 003 | T01 | PostgreSQL, migration và stack Docker local | 002 |
| 004 | T02 | Admin auth, RBAC, session và kế hoạch MFA | 003 |
| 005 | T03 | Windows Agent pairing và heartbeat | 004 |
| 006 | T04 | Job queue durable, lease và idempotency | 005 |
| 007 | T05 | Dashboard URL, workflow và lịch sử run | 006 |
| 008 | T06 | Direct HTTP downloader và bảo vệ URL | 007 |
| 009 | T07 | Media validation và FFmpeg preset | 008 |
| 010 | T08 | MinIO artifact upload và retention | 009 |
| 011 | T09 | Meta Facebook feasibility spike sớm | 004 |
| 012 | T10 | Facebook Page Publisher và reconciliation | 010, 011 |
| 013 | T11 | Workflow runner DAG và auto-publish policy | 012 |
| 014 | T12 | Alerts, quotas, schedule và cancel/retry | 013 |
| 015 | T13 | E2E hardening, backup/restore và deployment | 014 |
| 016 | T14 | Browser Worker và website adapters được phép | 015 |
| 017 | T15 | AI caption và provider integrations tùy chọn | 015 |
| 018 | T16 | YouTube Publisher tùy chọn | 015 |
| 019 | T17 | GUI Worker và tài liệu RustDesk tùy chọn | 016 |
| 020 | NONE | Tổng kiểm tra release và bàn giao | 015 |

Vòng đời: `docs/promt` → `docs/processing` → `docs/completed`. Prompt PARTIAL/BLOCKED giữ trong processing. Nhật ký ở `docs/IMPLEMENTATION_LOG.md`. 016–019 là mở rộng tùy chọn; gate 020 dựa trên MVP, không buộc hoàn thành các module tùy chọn.
