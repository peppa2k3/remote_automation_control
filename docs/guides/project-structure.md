# Cấu trúc dự án

Đây là monorepo pnpm. Chạy lệnh ở thư mục gốc, trừ khi guide ghi rõ khác.

| Đường dẫn | Vai trò hiện tại | Khi nào cần sửa |
|---|---|---|
| `frontend/src/app/` | Trang Next.js App Router, login, dashboard, `/devices`, route proxy cùng origin | Giao diện và route cho trình duyệt |
| `frontend/src/features/auth/`, `frontend/src/features/devices/` | Session server-side, form, proxy auth/device theo allowlist | Luồng đăng nhập hoặc quản lý thiết bị |
| `frontend/src/lib/` | Kiểm tra trạng thái API/DB cho dashboard | Hiển thị health |
| `backend/src/app.ts`, `backend/src/server.ts` | Express app, middleware, route và start server | Lớp HTTP và startup |
| `backend/src/modules/auth/`, `backend/src/modules/devices/` | Quy tắc auth, device, pairing, heartbeat | Nghiệp vụ và authorization phía server |
| `backend/prisma/schema.prisma`, `backend/prisma/migrations/` | Schema và migration PostgreSQL | Thay đổi dữ liệu có kiểm soát |
| `agent-windows/src/core/` | CLI pair, heartbeat, rotate; client HTTP và kho DPAPI | Kết nối Agent native trên Windows |
| `packages/contracts/` | Zod schema, DTO, response contract chung | Đổi payload chung giữa các thành phần |
| `infrastructure/compose/` | PostgreSQL native profile và stack Docker local | Chạy dịch vụ local |
| `scripts/` | Sinh env local, smoke/check stack và kiểm tra docs | Lệnh hỗ trợ phát triển |
| `docs/` | Bối cảnh, kiến trúc, ADR, API, guide và lịch sử triển khai | Giải thích hoặc ghi nhận thay đổi |

FE không truy cập PostgreSQL. FE gửi request qua Next.js route proxy và server-side fetch tới BE; BE kiểm tra session/quyền rồi mới truy cập DB qua Prisma. Agent kết nối **outbound** tới BE bằng credential riêng, không dùng session admin và không nhận kết nối inbound. Chi tiết endpoint hiện có ở [API](../API.md); sơ đồ định hướng dài hạn ở [ARCHITECTURE](../ARCHITECTURE.md).

Các file `*.env.example` là mẫu công khai. File `.env` thực tế chứa cấu hình local và không commit. Khi thêm biến cấu hình, cập nhật cả mẫu tương ứng và [guide cấu hình](configuration.md). Khi thay payload chung, sửa contract trước rồi cập nhật các bên dùng nó. Khi thay DB, tạo migration; không dùng `db push` hoặc reset DB có dữ liệu.

Thư mục `docs/promt/` chứa prompt chưa bắt đầu, `docs/processing/` chứa prompt đang làm hoặc còn gate, `docs/completed/` chứa prompt đã đạt acceptance. Sau khi hoàn thành một prompt, cập nhật [IMPLEMENTATION_LOG](../IMPLEMENTATION_LOG.md). Trạng thái hiện tại đọc ở [ROADMAP](../ROADMAP.md); riêng 005 vẫn ở `processing` do gate Windows 11 chưa xong.
