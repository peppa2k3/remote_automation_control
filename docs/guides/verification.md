# Kiểm tra kết nối

Khi web/API đang chạy:

```powershell
pnpm stack:check
pnpm agent:diagnose
```

PASS xác nhận web/API/DB và route cơ bản. Sau đó pair/start và xem **Agent online** tại `/devices` để xác nhận toàn luồng.

| Lỗi | Xử lý |
|---|---|
| `pnpm` không tìm thấy | Cài Node 24, chạy `npm install --global pnpm@11.12.0`, mở terminal mới |
| Docker không có Server hoặc lệnh treo | Mở Docker Desktop, chờ Engine; kiểm tra dung lượng ổ chứa Docker |
| `db:up` lỗi cổng 5432 | Kiểm tra dịch vụ đang chiếm cổng; hoặc đổi `POSTGRES_DEV_PORT` và backend `DATABASE_URL` cùng nhau |
| Migration lỗi kết nối | Chạy `pnpm db:up` thành công trước; kiểm tra DB URL/password |
| API `live` lỗi | Kiểm tra terminal `pnpm dev` và port 4000 |
| API `ready` lỗi | Kiểm tra PostgreSQL, `DATABASE_URL` và migration |
| Login 503 | Kiểm tra Next `API_INTERNAL_BASE_URL` trỏ đúng backend |
| Mutation 403 | Dùng đúng `http://localhost:3000`; Origin FE/BE phải khớp; thử đăng nhập lại |
| Pair lỗi | Mã 5 phút/dùng một lần; kiểm tra URL, tạo mã mới, chạy terminal tương tác |
| Agent yêu cầu pair lại | Kiểm tra đúng Windows user/server; credential có thể hết hạn hoặc bị revoke; xem [recovery](../DEVICES.md) |
| Web unknown | Kiểm tra server/kết nối; nếu session hết 30 phút, đăng nhập lại |

Kiểm tra VPS từ Windows, thay domain ví dụ:

```powershell
$env:CHECK_SITE_URL = 'https://control.example.com'
$env:CHECK_API_BASE_URL = 'https://control.example.com/api/v1'
pnpm stack:check
Remove-Item Env:CHECK_SITE_URL, Env:CHECK_API_BASE_URL
```

Linux: `CHECK_SITE_URL=https://control.example.com CHECK_API_BASE_URL=https://control.example.com/api/v1 pnpm stack:check`.

Mỗi request có timeout 10 giây; lệnh tiếp tục các bước còn lại khi lỗi và trả exit code 1. Không reset/prune/xóa volume để thử sửa kết nối. Kiểm thử DB/DPAPI dùng DB test riêng, xem [DATABASE](../DATABASE.md) và [DEVICES](../DEVICES.md).
