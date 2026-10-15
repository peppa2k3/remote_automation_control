# Context — Device Manager Corebase

## Mục tiêu hiện tại

Một Windows Agent kết nối outbound tới server; người dùng đăng nhập web để xem hoạt động thiết bị. Chạy local trước, sau đó chuyển FE/BE/DB lên VPS HTTPS. Hướng dẫn chính: `docs/guides/start-here.md`.

## Thành phần

- `frontend`: Next.js App Router + Tailwind; login, dashboard, devices và proxy browser cùng origin.
- `backend`: Express + Zod, Prisma/PostgreSQL 17; auth, quyền device, pairing, heartbeat và audit.
- `agent-windows`: Node.js native Windows; pair, heartbeat/reconnect, credential DPAPI CurrentUser.
- `packages/contracts`: schema/DTO dùng chung. Node.js 24, pnpm 11.12.0, TypeScript strict.

## Logic cố định

1. CLI tạo owner đầu tiên; user đăng nhập bằng cookie session HttpOnly + CSRF. Không có signup công khai.
2. User tạo mã pair 256-bit, hạn 5 phút, dùng một lần; Agent xác nhận URL server rồi nhập mã tại terminal. Người tạo mã là owner device.
3. Device credential riêng, TTL 24 giờ, hash tại DB và mã hóa DPAPI ở Windows. Agent tự rotate khi còn dưới 6 giờ; không dùng cookie user cho Agent.
4. Agent heartbeat 5 giây, web lấy snapshot mỗi 5 giây. ONLINE cần credential hợp lệ và heartbeat mới hơn 25 giây, sau lần khởi động backend hiện tại.
5. Mất server: web xóa snapshot, báo unknown. Agent retry lỗi mạng có backoff; lỗi xác thực thì dừng. Khôi phục kết nối không tự pair lại.
6. Chỉ owner/member được xem device. Chỉ owner device chia sẻ/thu hồi; global OWNER không có quyền ngầm. VIEWER/OPERATOR hiện đều chỉ xem.
7. Chạy một backend instance. PostgreSQL lưu trạng thái; Agent không mở cổng inbound và không thực thi lệnh từ web.

## Cách chạy chuẩn

- Local Windows: FE `localhost:3000`, API `localhost:4000/api/v1`, DB Docker `localhost:5432`; Agent native trên cùng máy.
- VPS: một domain HTTPS; `/api/v1/agent/*` và `/api/v1/health/*` tới backend, còn lại tới Next. DB không public.
- Env mẫu và code là cấu hình thực tế; không thêm biến cho tính năng chưa có. Không sửa `.env` thật hoặc reset DB của người dùng.

## Phạm vi tiếp theo

Core hiện chỉ giám sát. Lease/ACK (022), allowlist runner (023), MeshCentral (024) và automation là backlog; chỉ triển khai khi có yêu cầu. Chưa có Windows Service, Linux Agent, MFA hoặc reset mật khẩu.

Kiểm thử local đã có; chưa nghiệm thu Windows 11 và VPS/domain thật của người dùng. Bằng chứng nằm trong `docs/IMPLEMENTATION_LOG.md`. Chi tiết luồng ở `docs/ARCHITECTURE.md`, quy tắc ở `AGENTS.md`. Thiết kế cũ được giữ tại `docs/archive/automation-baseline.md`.
