# Home Automation Control Platform

## Core quản lý thiết bị — bắt đầu tại đây

Kết nối máy Windows tại nhà tới server/VPS và đăng nhập web để xem online/offline, uptime, RAM, lịch sử; chia sẻ quyền xem theo từng thiết bị. Bắt đầu bằng [hướng dẫn từng bước cho người mới](docs/guides/start-here.md), sau đó [thiết lập VPS HTTPS](docs/guides/vps-setup.md).

Logic phù hợp từ `remote-control-agent-core-base` đã được chuyển vào các workspace hiện tại: quyền owner/member, pairing 256-bit có xác nhận tại local, heartbeat/poll 5 giây và trạng thái unknown khi mất server. Giữ Next.js, PostgreSQL, auth/session, DPAPI và credential rotation đã có. Xem [bản đồ chuyển đổi và lộ trình](docs/CORE_ROADMAP.md). Thư mục starter là tham chiếu, không chạy `npm install` hoặc build app thứ hai trong đó.

Core hiện chỉ giám sát: lease/ACK, desktop/MeshCentral và chạy script nằm ở các prompt tiếp theo. Chưa nghiệm thu kết nối trên VPS/domain thật và gate Windows 11 của 005 còn pending. Phần automation tải file/publish ở mô tả baseline bên dưới thuộc giai đoạn nâng cao.

Hướng dẫn từng bước về cài đặt, cấu hình FE/BE/DB/Agent, luồng kết nối và xử lý lỗi: [docs/guides](docs/guides/README.md).

Website/PWA điều phối Windows Agent tại nhà: nhận URL, tải và xử lý file, sau đó đăng lên Facebook Page qua API theo workflow đã cấu hình. VPS giữ trạng thái và quyền; Agent chủ động kết nối outbound.

Repo đã hoàn thành prompt 001–004 và triển khai pairing/heartbeat của 005: owner UI quản lý thiết bị, credential scoped, DPAPI và rotate/revoke. Gate kiểm thử Win11 của 005 còn thiếu (máy hiện tại Windows 10), nên prompt giữ PARTIAL. Durable queue, tải file, publish và MFA thực còn trong backlog; chưa production-ready.

## Yêu cầu

- Node.js 24 LTS, pnpm 11.12.0 (khóa bằng `packageManager`).
- Docker Desktop dùng Linux containers / Docker Compose để chạy PostgreSQL 17 và full stack local.
- Windows Agent chạy native Node.js; không đưa Agent GUI vào Docker.

## Chạy native để phát triển

PowerShell từ root:

```powershell
pnpm install --frozen-lockfile
pnpm setup:local
```

`setup:local` tạo mật khẩu PostgreSQL random và các env local; không ghi đè file đã có, không in secret. Env này chỉ dành cho local. Nếu cấu hình thủ công, dùng mật khẩu hex ngẫu nhiên (Compose ghép vào connection URL) và có thể copy các mẫu:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
Copy-Item agent-windows/.env.example agent-windows/.env
Copy-Item infrastructure/compose/.env.example infrastructure/compose/.env
```

Khi copy thủ công, điền `POSTGRES_PASSWORD` hex vào compose `.env` và cập nhật mật khẩu tương ứng trong `backend/.env`. Không commit `.env`. Bỏ qua bước copy nếu đã chạy `setup:local`.

```powershell
docker compose -f infrastructure/compose/compose.yml --profile native up -d postgres-dev
pnpm db:generate
pnpm db:migrate
pnpm build
pnpm owner:bootstrap
pnpm dev
```

`owner:bootstrap` yêu cầu terminal tương tác: nhập email, mật khẩu ẩn 12–128 ký tự (tối đa 128 byte UTF-8), rồi xác nhận. Chỉ tạo một owner và từ chối ghi đè; không truyền password trong lệnh/env. Mở `http://localhost:3000/login` để đăng nhập. Dashboard chuyển về login nếu chưa có session. API native ở `http://localhost:4000/api/v1`. Nếu đổi port, cập nhật backend FRONTEND_ORIGIN và frontend AUTH_FRONTEND_ORIGIN/NEXT_PUBLIC_SITE_URL giống nhau, cùng URL API/Agent tương ứng. `pnpm dev` chỉ start FE/API; Agent CLI chạy riêng:

```powershell
pnpm --filter @automation/agent-windows diagnose
```

Lệnh diagnose chỉ kiểm tra health. Owner mở `/devices` để tạo mã 5 phút; trên Windows chạy `pnpm --filter @automation/agent-windows pair` và nhập mã ẩn, sau đó `pnpm --filter @automation/agent-windows start` để heartbeat. Credential lưu DPAPI CurrentUser, không đặt token trong env/argument. `rotate` và `heartbeat` là lệnh một lần; revoke qua UI owner. Không tạo job hoặc publish. `AGENT_ALLOW_LOCAL_HTTP=true` chỉ cho localhost trong dev; production URL bắt buộc HTTPS. Xem [DEVICES](docs/DEVICES.md) về storage, reconnect, TTL, recovery và test Win11.

## Chạy toàn bộ stack Docker local

Sau khi điền compose `.env`:

```powershell
docker compose -f infrastructure/compose/compose.yml --profile stack up --build -d
```

Frontend ở `http://localhost:3000`, API ở `http://localhost:4000/api/v1`; migration service chạy xong trước API. DB full stack không expose host. Đừng chạy đồng thời full stack và native FE/API trên cùng port. `postgres-dev` là DB/volume khác với DB của full stack.

Tạo owner riêng cho DB Docker bằng terminal tương tác (đừng dùng `-T`):

```powershell
docker compose -f infrastructure/compose/compose.yml exec backend pnpm owner:bootstrap
```

Chạy `pnpm stack:check` để kiểm tra health/DB, chuyển hướng dashboard chưa đăng nhập, trang login, manifest/icon và build assets. Nếu đổi port, đặt `CHECK_API_BASE_URL` / `CHECK_SITE_URL`. `pnpm --filter @automation/agent-windows diagnose` kiểm tra Agent native kết nối stack này. Chi tiết quyền/session và giới hạn MFA tại [AUTH](docs/AUTH.md).

```powershell
docker compose -f infrastructure/compose/compose.yml --profile stack down
```

Lệnh này giữ volume. Production Traefik/domain/MinIO được cấu hình ở prompt deployment sau khi xác minh hạ tầng.

## Kiểm tra

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm docs:check
```

Integration database chạy trên DB **test riêng, chưa có owner**, đã migrate; đặt DATABASE_URL trong process đến DB đó trước khi chạy. Không dùng DB có tài khoản hoặc dữ liệu thật. Test chỉ xóa fixture của chính nó, không reset database:

```powershell
$env:RUN_DB_TESTS = '1'
pnpm --filter @automation/backend test:integration
Remove-Item Env:RUN_DB_TESTS
```

CI chạy lint/typecheck/unit/build, PostgreSQL service + migration + DB integration, runtime smoke FE/API/Agent. `pnpm smoke` kiểm tra anonymous; đặt SMOKE_DATABASE_URL đến DB test đã migrate để kiểm tra thêm login/CSRF/refresh/logout qua frontend với tài khoản ADMIN tạm, tự dọn fixture. Kết quả đã chạy và giới hạn nằm trong [nhật ký](docs/IMPLEMENTATION_LOG.md).

## Cấu trúc và tài liệu

```text
frontend/                 Next.js App Router + Tailwind
backend/                  Express + Prisma + health
agent-windows/            CLI native, outbound only
packages/contracts/       Zod schemas / TypeScript DTO
infrastructure/compose/   Dockerfiles + stack local riêng
docs/promt/               Prompt PLANNED
docs/processing/          Prompt đang làm / PARTIAL
docs/completed/           Prompt DONE có bằng chứng
docs/IMPLEMENTATION_LOG.md Nhật ký sau mỗi prompt
```

- [Đặc tả](docs/PROJECT_CONTEXT.md), [kiến trúc](docs/ARCHITECTURE.md), [context rules](docs/CONTEXT_RULES.md).
- [Quy tắc agent](AGENTS.md), [API](docs/API.md), [database](docs/DATABASE.md), [bảo mật](docs/SECURITY.md), [vận hành](docs/OPERATIONS.md), [Windows Agent](docs/DEVICES.md).
- [Roadmap](docs/ROADMAP.md): ID 001–020 map T00–T17, gate và dependencies. Meta feasibility spike chạy sớm sau auth.

Sau mỗi prompt: `promt` → `processing` → kiểm tra → `completed` → append nhật ký → commit riêng. Prompt chưa đạt gate phải ở `processing`; không tạo dữ liệu thành công giả trong dashboard.
