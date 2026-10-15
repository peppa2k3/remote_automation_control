# Vận hành core

- Local: `pnpm db:up`, `pnpm dev`; terminal khác `pnpm agent:start`. Lần đầu theo [start-here](guides/start-here.md).
- Kiểm tra: `pnpm stack:check`, `pnpm agent:diagnose`. Web `/devices` hiển thị trạng thái và activity.
- Dừng: Ctrl+C web/Agent, `pnpm db:stop`. Chạy lại giữ owner/credential; không pair/bootstrap mỗi lần.
- Chỉ chạy một backend. Agent dùng đúng Windows user đã pair, giữ terminal mở; chưa có Windows Service.
- Migration: `pnpm db:migrate`; build lại khi đổi code. Không reset/db push/down -v với DB cần giữ.
- VPS: theo [vps-setup](guides/vps-setup.md), giữ nguyên bộ Compose `-f` đã chọn ở mọi lệnh. Backup DB/env trước nâng cấp; chưa tự động hóa backup/restore.
- Token Agent hết hạn sau 24 giờ offline có thể cần recovery; [DEVICES](DEVICES.md). Session web hết sau 30 phút nếu không gia hạn; đăng nhập lại khi cần.

Lỗi kết nối: [verification](guides/verification.md). Nhật ký kiểm thử: [IMPLEMENTATION_LOG](IMPLEMENTATION_LOG.md).
