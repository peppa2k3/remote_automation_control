# Vận hành local

Theo README, chạy `pnpm setup:local` để tạo env local (không ghi đè), rồi start native hoặc full stack. Health live đo tiến trình; ready đo kết nối database. Agent diagnose kiểm tra health; pair/start thực hiện pairing và heartbeat.

005 đã thêm pair/start/heartbeat/rotate và owner revoke UI. Windows Service install/reboot chưa thực hiện. Pair bằng cùng Windows identity sẽ chạy Agent; DPAPI CurrentUser yêu cầu profile. Không đổi sang LocalMachine hoặc đặt token trong env để khắc phục lỗi. [DEVICES](DEVICES.md) hướng dẫn recovery, credential TTL và `pnpm agent:smoke` trên Windows 11/DB test riêng. Gate Win11 hiện còn pending.

Stack Docker dùng project `home-automation-local`; ports chỉ bind loopback. `down` giữ volumes; không dùng `down -v` với dữ liệu cần giữ. Không stop/remove các container không thuộc stack.

Migration bằng `pnpm db:migrate` hoặc service migrate trong Compose. Không chạy Prisma reset/db push lên dữ liệu shared. Backup/restore, Traefik production, registry/CD và Windows Service cập nhật có xác minh thuộc prompt 015/005.

Production phải cấu hình domain, network/certresolver Traefik, DB credential, encryption keys cho MFA/provider, MinIO scoped keys và quyền Page thực. Session opaque hiện không cần khóa ký chung. Không sử dụng env dev cho production; Secure cookie và HTTPS FRONTEND_ORIGIN bắt buộc khi backend NODE_ENV=production. Proxy trust/IP policy còn phải kiểm thử trong prompt deployment.

Owner native: `pnpm owner:bootstrap`; owner Docker: `docker compose -f infrastructure/compose/compose.yml exec backend pnpm owner:bootstrap` từ terminal tương tác. Không truyền password trên CLI/env và không chạy với -T. Hai profile có DB riêng, owner riêng. Chưa có reset/recovery/MFA handler; xem [AUTH](AUTH.md) trước khi bật MFA. Cấu hình AUTH_SESSION_SECONDS/AUTH_ABSOLUTE_SECONDS trong backend (mặc định 1800/28800), absolute không ngắn hơn session. Frontend AUTH_FRONTEND_ORIGIN runtime phải trùng FRONTEND_ORIGIN, không trailing slash; fallback là NEXT_PUBLIC_SITE_URL build-time.

Dockerfile build/backend local dùng Node.js 24 Debian bookworm với OpenSSL có sẵn và giữ CLI Prisma/dependencies để service migration chạy được; frontend runtime dùng bookworm-slim + output standalone. Cả API/frontend chạy user `node`, có memory limits, healthchecks, restart policy và phụ thuộc migration. Image production được harden/scan và build-push trong prompt 015.

Service `migrate` dùng lại image backend, không build/export thêm một image giống hệt. PostgreSQL healthcheck qua TCP và có startup grace period để không nhận nhầm server tạm trong lúc initdb. Grace period 120 giây và 30 lần thử cách nhau 5 giây cho phép volume mới khởi tạo trên Windows có I/O chậm; service vẫn được công nhận healthy ngay khi TCP sẵn sàng.
