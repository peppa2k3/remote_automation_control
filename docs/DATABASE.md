# Database khởi tạo

PostgreSQL 17, Prisma ORM, timestamps UTC. Migration ban đầu chỉ tạo `SystemCheck` (UUID, label unique, createdAt/updatedAt) dùng kiểm thử write/read/delete trên database local/CI biệt lập. Không dùng bảng này làm queue.

Schema business và các unique/index từ mục 5 `PROJECT_CONTEXT.md` được thêm qua migration trong prompt auth/device/queue tương ứng. Không chạy reset/db push trên DB có dữ liệu.

`pnpm db:generate` không cần DB chạy; `pnpm db:migrate` chạy migration đã commit. Integration test chỉ chạy khi `RUN_DB_TESTS=1` và dùng URL DB local/CI. Không tự trỏ vào DB shared/production. Database test tạo record có label UUID riêng rồi xóa đúng record đó; kiểm tra unique label và ready 200 với DB thật, ready 503/live 200 khi kết nối DB không khả dụng.

`pnpm setup:local` tạo env mới bằng ghi exclusive (không ghi đè), mật khẩu hex ngẫu nhiên phù hợp connection URL. Dev DB/volume `postgres-dev-data` khác DB full stack `postgres-data`.
