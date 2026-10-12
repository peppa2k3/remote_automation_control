# API hiện tại

Base path `/api/v1`. Envelope luôn có `success`, `data`, `error`, `requestId`. Header `X-Request-Id` trùng trường JSON. Error chỉ có `code` và thông báo an toàn.

| Method / path | Status | Hành vi |
|---|---|---|
| `GET /health/live` | 200 | Tiến trình API đang chạy, không phụ thuộc DB |
| `GET /health/ready` | 200 / 503 | `SELECT 1` qua Prisma thành công / thất bại |
| Path chưa triển khai | 404 | `NOT_FOUND`, không có tác dụng phụ |
| JSON body sai | 400 | `INVALID_JSON` |
| Body quá lớn | 413 | `PAYLOAD_TOO_LARGE` |
| Vượt rate limit | 429 | `RATE_LIMITED` |

Ví dụ live:

```json
{"success":true,"data":{"service":"backend","status":"ok","timestamp":"2026-10-12T00:00:00.000Z"},"error":null,"requestId":"<UUID>"}
```

Ready thành công thêm `database: "up"`; khi DB lỗi trả `data: null`, `error.code: "DATABASE_UNAVAILABLE"`. Đây là kết quả ping DB, chưa chứng minh mọi bảng nghiệp vụ đã migrate.

Các endpoint auth/devices/workflow/runs/agent/provider trong `PROJECT_CONTEXT.md` là thiết kế mục tiêu. Chưa có route nghiệp vụ hoặc socket channel ở bootstrap.
