# Home Automation Control Platform

Website/PWA điều phối Windows Agent tại nhà: nhận URL, tải và xử lý file, sau đó đăng lên Facebook Page qua API theo workflow đã cấu hình. VPS giữ trạng thái và quyền; Agent chủ động kết nối outbound.

Repo đang ở giai đoạn bootstrap (prompt 001–003). Đã có trang tình trạng kết nối, API health, PostgreSQL/Prisma và Agent CLI chẩn đoán. Auth, pairing, durable queue, tải file và publish nằm trong backlog; chưa production-ready.

## Yêu cầu

- Node.js 24 LTS, pnpm 11.12.0 (khóa bằng `packageManager`).
- Docker Desktop dùng Linux containers / Docker Compose để chạy PostgreSQL 17 và full stack local.
- Windows Agent chạy native Node.js; không đưa Agent GUI vào Docker.

## Chạy native để phát triển

PowerShell từ root:

```powershell
pnpm install --frozen-lockfile
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
Copy-Item agent-windows/.env.example agent-windows/.env
Copy-Item infrastructure/compose/.env.example infrastructure/compose/.env
```

Điền `POSTGRES_PASSWORD` vào compose `.env` và cập nhật mật khẩu tương ứng trong `backend/.env` (URL-encode ký tự đặc biệt của URL). Không commit `.env`.

```powershell
docker compose -f infrastructure/compose/compose.yml --profile native up -d postgres-dev
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Mở `http://localhost:3000`. API native ở `http://localhost:4000/api/v1`. Nếu đổi port thì cập nhật backend env và frontend/Agent URL tương ứng. `pnpm dev` chỉ start FE/API; Agent CLI chạy riêng:

```powershell
pnpm --filter @automation/agent-windows diagnose
```

CLI chỉ kiểm tra health; không tạo job, pairing hoặc publish. `AGENT_ALLOW_LOCAL_HTTP=true` chỉ cho localhost trong dev; production URL bắt buộc HTTPS.

## Chạy toàn bộ stack Docker local

Sau khi điền compose `.env`:

```powershell
docker compose -f infrastructure/compose/compose.yml --profile stack up --build -d
```

Frontend ở `http://localhost:3000`, API ở `http://localhost:4000/api/v1`; migration service chạy xong trước API. DB full stack không expose host. Đừng chạy đồng thời full stack và native FE/API trên cùng port. `postgres-dev` là DB/volume khác với DB của full stack.

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

Integration database chạy trên DB local/CI đã migrate:

```powershell
$env:RUN_DB_TESTS = '1'
pnpm --filter @automation/backend test:integration
Remove-Item Env:RUN_DB_TESTS
```

CI chạy lint/typecheck/unit/build, PostgreSQL service + migration + DB integration, runtime smoke FE/API/Agent. Kết quả đã chạy và giới hạn nằm trong [nhật ký](docs/IMPLEMENTATION_LOG.md).

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
- [Quy tắc agent](AGENTS.md), [API](docs/API.md), [database](docs/DATABASE.md), [bảo mật](docs/SECURITY.md), [vận hành](docs/OPERATIONS.md).
- [Roadmap](docs/ROADMAP.md): ID 001–020 map T00–T17, gate và dependencies. Meta feasibility spike chạy sớm sau auth.

Sau mỗi prompt: `promt` → `processing` → kiểm tra → `completed` → append nhật ký → commit riêng. Prompt chưa đạt gate phải ở `processing`; không tạo dữ liệu thành công giả trong dashboard.
