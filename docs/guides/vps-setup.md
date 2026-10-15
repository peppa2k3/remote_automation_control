# VPS HTTPS

Chạy local theo [start-here](start-here.md) trước. VPS Linux cần Docker Engine + Compose plugin, Node.js 24, domain trỏ DNS về VPS và TCP 80/443 hoạt động. Chỉ dùng một backend instance.

## 1. Chuẩn bị server

Clone source vào thư mục riêng, mở root. Thay domain/email ví dụ bằng giá trị thật:

```bash
node scripts/setup-vps.mjs control.example.com admin@example.com
```

Tạo `infrastructure/vps/.env` với password DB random; không ghi đè file đã có. Không copy env local lên VPS.

## 2. Chạy — chọn một nhánh

**VPS mới, cổng 80/443 còn trống:** dùng Caddy có sẵn trong stack.

```bash
docker compose -f infrastructure/vps/compose.yml config --quiet
docker compose -f infrastructure/vps/compose.yml up --build -d
docker compose -f infrastructure/vps/compose.yml exec backend pnpm owner:bootstrap
```

**VPS đã có Traefik:** lấy đúng tên network/entrypoint/resolver từ cấu hình đang chạy, thêm vào `infrastructure/vps/.env`:

```dotenv
TRAEFIK_NETWORK=<network-thuc>
TRAEFIK_HTTPS_ENTRYPOINT=<entrypoint-thuc>
TRAEFIK_CERTRESOLVER=<resolver-thuc>
```

Dùng đủ hai `-f` ở mọi lệnh; gateway Caddy sẽ không được bật:

```bash
docker compose -f infrastructure/vps/compose.yml -f infrastructure/vps/compose.traefik.yml config --quiet
docker compose -f infrastructure/vps/compose.yml -f infrastructure/vps/compose.traefik.yml up --build -d
docker compose -f infrastructure/vps/compose.yml -f infrastructure/vps/compose.traefik.yml exec backend pnpm owner:bootstrap
```

`migrate` kết thúc exit 0 là bình thường. Mở `https://<domain>/login` và `https://<domain>/api/v1/health/ready`; health phải trả `success: true`. Nếu proxy khác đang giữ 80/443, cần cấu hình route theo bảng cuối trước khi chạy; không bật thêm Caddy chiếm cổng.

## 3. Kết nối Windows

Trên Windows đã cài dependencies/build theo guide local, dừng Agent và sửa `agent-windows/.env`:

```dotenv
AGENT_API_BASE_URL=https://control.example.com/api/v1
AGENT_ALLOW_LOCAL_HTTP=false
AGENT_REQUEST_TIMEOUT_MS=5000
AGENT_STATE_DIR=C:/AutomationControlVps
```

Thay domain thật. Thư mục state riêng giúp không dùng nhầm credential local. Tạo mã trên web VPS, rồi chạy tại root trên Windows:

```powershell
pnpm agent:diagnose
pnpm agent:pair
pnpm agent:start
```

Xác nhận URL, nhập `YES`, tên máy và mã ẩn. Web phải thấy Agent online; thử dừng/chạy lại Agent và mở web từ mạng khác. Kiểm tra đầy đủ bằng [verification](verification.md).

## Route và vận hành

| Route HTTPS | Upstream |
|---|---|
| `/api/v1/agent/*`, `/api/v1/health/*` | `backend:4000` |
| Còn lại, gồm auth/devices | `frontend:3000` |

Next gọi `http://backend:4000/api/v1`; Origin FE/BE cùng `https://<domain>`. Không public port 3000/4000/5432. Mẫu chỉ phù hợp số ít máy/user vì rate limit hiện gộp IP qua proxy.

Dùng cùng bộ `-f` đã chọn với `ps`, `logs --tail=80 backend frontend migrate`, `exec backend pnpm user:create` hoặc `down`. `down` giữ DB; không dùng `down -v`. Đổi domain cần build lại. Agent hiện chạy trong terminal với đúng Windows user đã pair, chưa tự khởi động cùng máy.

Mẫu cấu hình chưa được nghiệm thu trên VPS/domain thật của bạn; không coi build/config thành công là bằng chứng kết nối Internet.
