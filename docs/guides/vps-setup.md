# Chạy core trên VPS, kết nối Windows tại nhà

Đây là hướng dẫn cấu hình và checklist nghiệm thu. Chưa có quyền truy cập VPS/domain của bạn để chứng minh kết nối Internet thật. Hãy chạy [bài thực hành local](start-here.md) trước.

## 1. Chọn cách đưa HTTPS vào ứng dụng

Mẫu `infrastructure/vps/compose.yml` dành cho **VPS Linux còn trống cổng 80/443**. Nó tạo stack riêng `device-manager-vps`, PostgreSQL riêng, FE/BE và Caddy cấp HTTPS cho một domain. FE/BE/DB không publish port riêng ra host.

Nếu VPS đã có Traefik/Caddy/nginx giữ cổng 80/443, **không chạy gateway mới trên các cổng đó**. Giữ proxy hiện hữu, nối các service vào network đã kiểm tra và áp dụng bảng route ở cuối guide; chưa có tên network/certresolver thực nên repo không tự đoán cấu hình Traefik.

Với Traefik, repo có sẵn `compose.traefik.yml`; dùng nhánh **3B** bên dưới thay cho 3A. Với Caddy/nginx có sẵn, dùng bảng route ở cuối và cấu hình của proxy đó.

Chuẩn bị: domain/subdomain bạn sở hữu, bản ghi DNS A trỏ IPv4 VPS (AAAA chỉ khi IPv6 hoạt động), Docker Engine + Docker Compose plugin, Node.js 24 để chạy script setup, quyền mở TCP 80/443. Với DB và build Next.js, dành đủ RAM; mẫu giới hạn runtime cộng khoảng 2 GiB, build cần thêm RAM. Không mở 3000, 4000, 5432 ra Internet.

## 2. Đưa source lên VPS

Clone repository của bạn vào thư mục riêng rồi `cd` tới root. Không copy `.env` local hoặc credential DPAPI Windows. Kiểm tra:

```bash
node --version
docker version
docker compose version
```

Thay hai giá trị ví dụ sau bằng domain/email thật của bạn; domain không có `https://` và không có dấu `/`:

```bash
node scripts/setup-vps.mjs control.example.com admin@example.com
```

Script tạo `infrastructure/vps/.env` với mật khẩu DB random và quyền file `0600`; không in secret, không ghi đè env đã có. Các biến gồm `PUBLIC_DOMAIN`, `ACME_EMAIL`, `POSTGRES_USER`, `POSTGRES_DB`, `POSTGRES_PASSWORD`. Không chạy `setup:local` để cấu hình VPS.

## 3A. Build và khởi động khi cổng 80/443 còn trống

```bash
docker compose -f infrastructure/vps/compose.yml config --quiet
docker compose -f infrastructure/vps/compose.yml up --build -d
docker compose -f infrastructure/vps/compose.yml ps
docker compose -f infrastructure/vps/compose.yml logs --tail=80 migrate backend frontend gateway
```

`migrate` kết thúc với exit code 0 là bình thường. DB phải healthy trước migration, API ready trước FE, FE healthy trước gateway. Nếu dùng domain mới, đợi DNS đúng và Caddy lấy certificate thành công.

Tạo owner bằng terminal tương tác (không thêm `-T`):

```bash
docker compose -f infrastructure/vps/compose.yml exec backend pnpm owner:bootstrap
```

Mở `https://<domain>/login`, đăng nhập. Kiểm tra `https://<domain>/api/v1/health/ready` trả `success: true`. Đổi domain sau build cần cập nhật env và `up --build -d` để URL build-time của FE khớp.

## 3B. Dùng Traefik hiện hữu (thay cho 3A)

Đọc cấu hình Traefik đang chạy để lấy tên network, HTTPS entrypoint và certificate resolver. `docker network ls` giúp đối chiếu network; tên entrypoint/resolver lấy từ cấu hình Traefik hoặc labels của ứng dụng đang chạy đúng HTTPS. Không tạo/sửa lại Traefik. Thêm ba biến sau vào `infrastructure/vps/.env`, thay nội dung trong dấu `<...>` bằng tên đã kiểm tra:

```dotenv
TRAEFIK_NETWORK=<network-hien-huu>
TRAEFIK_HTTPS_ENTRYPOINT=<https-entrypoint-hien-huu>
TRAEFIK_CERTRESOLVER=<resolver-hien-huu>
```

Chạy đầy đủ **hai** `-f` ở mọi lệnh của nhánh này:

```bash
docker compose -f infrastructure/vps/compose.yml -f infrastructure/vps/compose.traefik.yml config --quiet
docker compose -f infrastructure/vps/compose.yml -f infrastructure/vps/compose.traefik.yml up --build -d
docker compose -f infrastructure/vps/compose.yml -f infrastructure/vps/compose.traefik.yml ps
docker compose -f infrastructure/vps/compose.yml -f infrastructure/vps/compose.traefik.yml exec backend pnpm owner:bootstrap
```

Override đưa gateway Caddy vào profile không bật, gắn FE/BE vào network Traefik có sẵn và cấu hình hai router riêng. Không bật profile `standalone-gateway` ở nhánh này. Các tên router/service `device-manager-api` và `device-manager-web` phải chưa được ứng dụng khác dùng trên Traefik đó. DB chỉ ở network database nội bộ. Mở `https://<domain>/login` và health như 3A, rồi tiếp tục bước 4.

## 4. Kết nối Windows

Trên Windows đã cài dependencies và build Agent, sửa thủ công `agent-windows/.env`:

```dotenv
AGENT_API_BASE_URL=https://control.example.com/api/v1
AGENT_ALLOW_LOCAL_HTTP=false
AGENT_REQUEST_TIMEOUT_MS=5000
AGENT_STATE_DIR=D:/AutomationDataVps
```

Thay domain ví dụ bằng domain thật. Dùng thư mục state riêng nếu từng pair với localhost. Chạy tại root trên Windows:

```powershell
pnpm --filter @automation/agent-windows diagnose
pnpm --filter @automation/agent-windows pair
pnpm --filter @automation/agent-windows start
```

Tạo mã trên web VPS, kiểm tra URL và nhập `YES` tại Agent, nhập mã ẩn. Web từ điện thoại/PC sẽ thấy máy và số liệu cập nhật. Windows chỉ kết nối outbound HTTPS; không cấu hình port forwarding router nhà.

## 5. Kiểm chứng thực tế trước khi dùng thường xuyên

- Web từ mạng ngoài đăng nhập được và hiển thị đúng Agent.
- Dừng Agent/mất mạng: offline sau 25 giây không heartbeat cộng thời gian web poll.
- Mất kết nối từ browser tới VPS: UI unknown; nối lại nhận snapshot mới.
- Tạo user bằng `docker compose -f infrastructure/vps/compose.yml exec backend pnpm user:create`, chia sẻ một máy, kiểm tra user khác không thấy máy chưa được chia sẻ.
- Revoke: Agent bị từ chối; restart API không giữ trạng thái online từ trước khi có heartbeat mới.

Core chưa có Windows Service/installer tự khởi động và chưa bảo đảm chạy khi chưa đăng nhập. Hiện giữ terminal Agent mở với đúng tài khoản Windows đã pair; không chạy dưới SYSTEM hoặc chuyển DPAPI sang user khác. Lease ACK, script và remote desktop nằm trong [lộ trình mới](../CORE_ROADMAP.md).

## 6. Vận hành và proxy hiện hữu

`docker compose -f infrastructure/vps/compose.yml down` giữ volume. Trước nâng cấp, backup DB và giữ env ở nơi riêng. Không dùng `down -v` hay Prisma reset với dữ liệu cần giữ. Credential offline hết hạn sau 24 giờ có thể cần revoke/pair lại; [DEVICES](../DEVICES.md) mô tả recovery.

| Route trên domain HTTPS | Upstream trong network app |
|---|---|
| `/api/v1/agent/*`, `/api/v1/health/*` | `backend:4000`, giữ nguyên path |
| Các route còn lại, gồm `/api/v1/auth/*`, `/api/v1/devices/*` | `frontend:3000` |

FE server gọi API qua `http://backend:4000/api/v1`. BE `FRONTEND_ORIGIN` và FE `AUTH_FRONTEND_ORIGIN` phải cùng `https://<domain>`. Không định tuyến toàn bộ `/api` thẳng vào BE vì auth/device của browser đi qua proxy Next. Backend dùng secure cookie; không tắt TLS verification ở Agent.

Bước này phù hợp số ít máy/người dùng. Rate limit hiện gộp các request qua proxy vào IP upstream; chưa cấu hình trust proxy/IP khách để vận hành số lượng lớn. Không tự bật `trust proxy=true` trên một backend có thể bị truy cập trực tiếp.

Nguồn cấu hình proxy: [Caddy handle](https://caddyserver.com/docs/caddyfile/directives/handle), [reverse_proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [image chính thức](https://hub.docker.com/_/caddy). Tích hợp MeshCentral không cần để chạy core này.

Nhánh Traefik theo [Docker provider](https://doc.traefik.io/traefik/providers/docker/) và [HTTP routers](https://doc.traefik.io/traefik/routing/routers/). Với nhánh này, các lệnh user:create/logs/down/nâng cấp cũng cần cả hai `-f` như bước 3B.
