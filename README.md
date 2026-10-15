# Device Manager Corebase

Kết nối **Windows Agent → server → web**, xem online/offline, uptime, RAM và lịch sử thiết bị.

**Máy mới: làm theo [hướng dẫn chạy lần đầu](docs/guides/start-here.md).**

- Stack: Node.js 24, pnpm 11.12.0, Next.js, Express, PostgreSQL 17.
- Hiện có: đăng nhập, pairing, heartbeat/reconnect, thu hồi và chia sẻ quyền xem.
- Chưa có: chạy lệnh/script, remote desktop, workflow/publish, Windows Service.

| Cần đọc | Tài liệu |
|---|---|
| Cài và chạy local từ đầu | [start-here](docs/guides/start-here.md) |
| Đưa server lên VPS HTTPS | [vps-setup](docs/guides/vps-setup.md) |
| URL, env và cổng | [configuration](docs/guides/configuration.md) |
| Lỗi kết nối | [verification](docs/guides/verification.md) |
| Logic và cấu trúc core | [ARCHITECTURE](docs/ARCHITECTURE.md) |
| Context cho AI | [PROJECT_CONTEXT](PROJECT_CONTEXT.md), [AGENTS](AGENTS.md) |
| Tiến độ phát triển | [CORE_ROADMAP](docs/CORE_ROADMAP.md), [nhật ký](docs/IMPLEMENTATION_LOG.md) |

Kiểm tra code: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
Phân tích source/dependency: [CodeGraph](docs/guides/codegraph.md), chạy `pnpm codegraph init --yes` tại root.
Kiểm tra sau khi bật web/API: `pnpm stack:check` và `pnpm agent:diagnose`.

Đã có kiểm thử tự động và runtime local biệt lập; lần chạy trên máy Windows 11/VPS của bạn cần kiểm chứng theo guide. Thiết kế automation cũ ở [archive](docs/archive/automation-baseline.md); source `remote-control-agent-core-base/` chỉ để tham khảo.
