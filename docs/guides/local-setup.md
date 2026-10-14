# Thiết lập local

## Yêu cầu

- Node.js 24, pnpm 11.12.0 (theo `package.json`) và Git.
- Docker Desktop ở chế độ Linux containers để chạy PostgreSQL 17 hoặc cả stack.
- Windows cho các lệnh pair/start/rotate/heartbeat của Agent. `diagnose` chỉ kiểm tra API health.

Mở PowerShell tại thư mục gốc, cài dependencies và tạo cấu hình:

```powershell
pnpm install --frozen-lockfile
pnpm setup:local
```

Script tạo `infrastructure/compose/.env`, `backend/.env`, `frontend/.env.local`, `agent-windows/.env` nếu chưa có; tạo mật khẩu PostgreSQL hex ngẫu nhiên và điền URL DB native tương ứng. Script **giữ nguyên** file đã có, nên nếu đổi mật khẩu/port về sau hãy đồng bộ thủ công theo [guide cấu hình](configuration.md). Không commit hoặc chia sẻ file env thực tế.

## Cách A: FE/BE chạy native, DB chạy Docker

```powershell
docker compose -f infrastructure/compose/compose.yml --profile native up -d postgres-dev
pnpm db:generate
pnpm db:migrate
pnpm build
pnpm owner:bootstrap
pnpm dev
```

`owner:bootstrap` hỏi email và mật khẩu trong terminal tương tác, tạo owner duy nhất và từ chối ghi đè. Mở <http://localhost:3000/login>; API ở <http://localhost:4000/api/v1>. `pnpm dev` chạy FE và BE, không tự chạy Agent. Để dừng, nhấn Ctrl+C trong terminal dev; khi không cần DB nữa, chạy:

```powershell
docker compose -f infrastructure/compose/compose.yml --profile native down
```

## Cách B: FE/BE/DB chạy trong Docker

```powershell
docker compose -f infrastructure/compose/compose.yml --profile stack up --build -d
docker compose -f infrastructure/compose/compose.yml exec backend pnpm owner:bootstrap
pnpm stack:check
```

Compose đợi PostgreSQL healthy, chạy migration rồi mới start backend và frontend. Owner được tạo trong DB của profile `stack`; không dùng chung owner/volume với profile `native`. Lệnh bootstrap cần terminal tương tác, không thêm `-T`. Mở <http://localhost:3000/login>. Khi dừng:

```powershell
docker compose -f infrastructure/compose/compose.yml --profile stack down
```

`down` giữ volume. Hai cách đều dùng port 3000/4000 mặc định; không chạy FE/BE native và full stack cùng lúc trên các port đó. DB của `stack` chỉ nằm trong mạng Docker, không mở cổng ra host; DB `postgres-dev` chỉ mở `127.0.0.1:5432` theo mặc định.

## Kết nối Windows Agent

Đặt `AGENT_API_BASE_URL` trong `agent-windows/.env` trỏ đến BE mà máy Windows truy cập được. Với BE chạy trên chính máy đó, mặc định là `http://localhost:4000/api/v1`. Nếu Agent ở máy khác, `localhost` là máy Agent, không phải máy chạy BE; cấu hình triển khai HTTPS và network phù hợp trước khi pair. Local HTTP chỉ được chấp nhận trên loopback khi `AGENT_ALLOW_LOCAL_HTTP=true`.

```powershell
pnpm --filter @automation/agent-windows diagnose
```

Đăng nhập, mở `/devices`, chọn Kết nối máy mới để tạo mã ghép đôi. Trên Windows, dùng cùng tài khoản Windows sẽ vận hành Agent:

```powershell
pnpm --filter @automation/agent-windows pair
pnpm --filter @automation/agent-windows build
pnpm --filter @automation/agent-windows start
```

`pair` yêu cầu kiểm tra URL server và nhập YES, rồi hỏi tên thiết bị và mã trong terminal; mã dùng một lần, hết hạn sau 5 phút. `start` chạy vòng heartbeat; có thể dừng bằng Ctrl+C. Credential lưu bằng DPAPI CurrentUser, không nhập token vào env hoặc tham số lệnh. Owner có thể revoke thiết bị trong `/devices`. Xem [DEVICES](../DEVICES.md) về rotate, recovery và giới hạn kiểm thử Windows 11.
