# Kiểm tra và xử lý lỗi local

Chạy ở root sau khi đã làm theo [thiết lập local](local-setup.md). Các lệnh dưới đây chỉ kiểm tra dịch vụ/đọc trạng thái, trừ lệnh migration/bootstrap được nêu trong guide thiết lập.

```powershell
Invoke-RestMethod http://localhost:4000/api/v1/health/live
Invoke-RestMethod http://localhost:4000/api/v1/health/ready
pnpm stack:check
pnpm --filter @automation/agent-windows diagnose
```

`stack:check` kiểm tra cả FE/API/DB, redirect dashboard ẩn danh và assets. Sau đó đăng nhập ở `http://localhost:3000/login`, mở `/devices`, tạo mã pair và kiểm tra thiết bị chuyển ONLINE sau khi Agent `start` heartbeat. Nếu chỉ muốn gửi một heartbeat rồi thoát, chạy `pnpm --filter @automation/agent-windows heartbeat` trên Windows đã pair.

| Triệu chứng | Kiểm tra đầu tiên | Cách xử lý |
|---|---|---|
| `live` lỗi kết nối | BE chưa chạy hoặc cổng sai | Kiểm tra `pnpm dev` hoặc `docker compose -f infrastructure/compose/compose.yml --profile stack ps`; so URL/cổng với env |
| `live` 200, `ready` 503 | BE không kết nối được DB | Kiểm tra container DB healthy, `DATABASE_URL`, user/password/port; `localhost` cho native, `postgres` cho stack |
| FE mở được nhưng login báo 503 | Next không tới BE | Kiểm tra `API_INTERNAL_BASE_URL`; trong container dùng `backend:4000`, native dùng `localhost:4000` |
| Login hoặc mutation 403 | Origin/CSRF không khớp | Mở FE bằng đúng `localhost` và cổng khai báo; so `FRONTEND_ORIGIN`, `AUTH_FRONTEND_ORIGIN`; dùng UI để gửi CSRF hợp lệ |
| Login không có owner | Chưa bootstrap đúng DB profile | Chạy `owner:bootstrap` bằng cách tương ứng; native và stack có DB riêng |
| Port 3000/4000/5432 đã dùng | Hai chế độ cùng chạy hoặc service khác giữ port | Dừng đúng chế độ đang chạy; khi đổi port Compose phải rebuild FE và cập nhật các URL liên quan |
| Agent `diagnose` lỗi | URL API hoặc TLS sai | So `AGENT_API_BASE_URL`; `localhost` chỉ trỏ về chính máy Agent; HTTP chỉ cho loopback local với cờ cho phép |
| Pair lỗi hoặc Agent OFFLINE | Mã đã hết hạn/dùng rồi; chưa start heartbeat; khác Windows user | Tạo mã mới, chạy Agent cùng Windows identity đã pair; xem [DEVICES](../DEVICES.md) trước khi recovery |

Khi cần xem trạng thái Docker:

```powershell
docker compose -f infrastructure/compose/compose.yml --profile stack ps
docker compose -f infrastructure/compose/compose.yml --profile stack logs --tail=100 backend frontend postgres migrate
```

Nếu đang dùng native DB, thay `--profile stack` bằng `--profile native` và xem service `postgres-dev`. Tránh đăng log/ảnh chụp chứa cookie, mã pair, token hoặc password. Không dùng `down -v` nếu muốn giữ dữ liệu.

Kiểm tra chất lượng code/tài liệu:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Integration DB và `agent:smoke` cần **DB test riêng, đã migrate**, không dùng DB đang có owner/device thật; xem [README](../../README.md), [DATABASE](../DATABASE.md) và [DEVICES](../DEVICES.md) trước khi chạy. `agent:smoke` trên Windows 11 là gate còn thiếu của prompt 005.
