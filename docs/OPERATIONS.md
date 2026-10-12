# Vận hành local

Theo README để tạo env local và start native hoặc full stack. Health live đo tiến trình; ready đo kết nối database. CLI Agent chỉ diagnose; chưa có Windows Service/pairing.

Stack Docker dùng project `home-automation-local`; ports chỉ bind loopback. `down` giữ volumes; không dùng `down -v` với dữ liệu cần giữ. Không stop/remove các container không thuộc stack.

Migration bằng `pnpm db:migrate` hoặc service migrate trong Compose. Không chạy Prisma reset/db push lên dữ liệu shared. Backup/restore, Traefik production, registry/CD và Windows Service cập nhật có xác minh thuộc prompt 015/005.

Production phải cấu hình domain, network/certresolver Traefik, DB credential, encryption/session keys, MinIO scoped keys và quyền Page thực. Không sử dụng env dev cho production.
