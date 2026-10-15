# Luồng kết nối

- Browser → Next `/api/v1/auth/*`, `/api/v1/devices/*` → Express → PostgreSQL.
- Windows Agent → Express `/api/v1/agent/*`, dùng bearer riêng, chỉ outbound.
- Agent heartbeat và web poll mỗi 5 giây; offline sau 25 giây, web mất server là unknown.
- Local: web `localhost:3000`, API `localhost:4000/api/v1`. VPS: một domain HTTPS, Next gọi backend qua Docker network.

Sơ đồ, quyền và vòng đời ở [ARCHITECTURE](../ARCHITECTURE.md). URL/env ở [configuration](configuration.md). Chạy thực tế theo [start-here](start-here.md).
