# Database khởi tạo

PostgreSQL 17, Prisma ORM, timestamps UTC. Migration ban đầu chỉ tạo `SystemCheck` (UUID, label unique, createdAt/updatedAt) dùng kiểm thử write/read/delete trên database local/CI biệt lập. Không dùng bảng này làm queue.

Schema business và các unique/index từ mục 5 `PROJECT_CONTEXT.md` được thêm qua migration trong prompt auth/device/queue tương ứng. Không chạy reset/db push trên DB có dữ liệu.

Migration `20261013000200_admin_auth` thêm enums UserRole/UserStatus và bảng users, auth_sessions, auth_throttles, audit_logs. Email unique; session tokenHash char(64) unique, FK user cascade, indexes user/revokedAt và expiry; throttle key hash char(64) + resetAt; audit indexes thời gian/id và actor/thời gian. Audit actorId/targetId giữ UUID lịch sử, không FK để không xóa audit khi xóa user.

Partial unique index `users_one_owner` trên role WHERE role='OWNER' đảm bảo chỉ một owner; Prisma schema không biểu diễn đầy đủ partial index này, phải giữ migration SQL và không thay bằng db push. Owner bootstrap, login budgets và session rotation/revoke dùng SQL advisory transaction locks; kết quả hàm lock kiểu void dùng executeRaw để tránh lỗi deserialize Prisma.

Integration auth yêu cầu DB test riêng chưa có owner, kiểm tra bootstrap đồng thời, unique owner, role negative, hash-only session, refresh/revoke race, trạng thái user và throttle durable. Test không xóa owner đã tồn tại; fixtures có UUID riêng và được dọn trong finally/afterAll. Chưa có cleanup job hoặc retention policy tự động cho các bảng auth/audit.

`pnpm db:generate` không cần DB chạy; `pnpm db:migrate` chạy migration đã commit. Integration test chỉ chạy khi `RUN_DB_TESTS=1` và dùng URL DB local/CI. Không tự trỏ vào DB shared/production. Database test tạo record có label UUID riêng rồi xóa đúng record đó; kiểm tra unique label và ready 200 với DB thật, ready 503/live 200 khi kết nối DB không khả dụng.

`pnpm setup:local` tạo env mới bằng ghi exclusive (không ghi đè), mật khẩu hex ngẫu nhiên phù hợp connection URL. Dev DB/volume `postgres-dev-data` khác DB full stack `postgres-data`.
