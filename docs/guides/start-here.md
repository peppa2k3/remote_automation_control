# Bắt đầu: kết nối máy của bạn và xem trên web

Bạn sẽ làm được: đăng nhập web → tạo mã ghép đôi → Agent trên Windows kết nối ra server → xem online/offline, uptime, RAM và lịch sử. Không cần cấu hình MeshCentral hoặc chạy script ở bước này.

## 1. Hiểu ba thành phần

| Thành phần | Chạy ở đâu khi học local | Khi dùng VPS |
|---|---|---|
| Web (Next.js) | Máy phát triển, port 3000 | Container frontend trên VPS |
| Server/API + PostgreSQL | Máy phát triển, API port 4000, DB Docker | Container backend/DB trên VPS |
| Agent | Windows của bạn | Vẫn trên Windows, kết nối HTTPS ra VPS |

Browser và Agent đều gọi server. Không mở port trên router nhà. `localhost` luôn là **máy đang chạy lệnh**, không phải tên thay thế cho VPS.

## 2. Chuẩn bị trên Windows

Cài Node.js 24, pnpm 11.12.0, Docker Desktop ở chế độ Linux containers. Mở terminal PowerShell tại thư mục gốc dự án (nơi có `pnpm-workspace.yaml`), không vào thư mục source tham khảo `remote-control-agent-core-base`.

```powershell
node --version
pnpm --version
docker version
pnpm install --frozen-lockfile
pnpm setup:local
```

Kết quả: có `backend/.env`, `frontend/.env.local`, `agent-windows/.env`, `infrastructure/compose/.env`. Script tạo mật khẩu DB và giữ nguyên file đã có. Không copy đè env nếu bạn đã thiết lập từ lần trước.

## 3. Khởi động DB và chuẩn bị code

```powershell
docker compose -f infrastructure/compose/compose.yml --profile native up -d postgres-dev
pnpm db:generate
pnpm db:migrate
pnpm build
```

Migration thêm owner/member/runtime, gán thiết bị cũ cho owner hệ thống hiện có; không reset DB. Build tạo code dùng chung và executable của Agent. DB full-stack Docker và DB native là hai DB khác nhau, hãy theo một cách chạy xuyên suốt.

Nếu đang nâng cấp từ 005, dừng Agent cũ bằng Ctrl+C trước khi build rồi chạy lại `start`. Backend mới yêu cầu heartbeat 5 giây; Agent cũ giữ nhịp 30 giây sẽ làm trạng thái chập chờn. Không cần xóa credential hoặc pair lại nếu vẫn dùng cùng server/DB và credential còn hạn.

## 4. Tạo tài khoản và mở web

Chỉ lần đầu với DB mới:

```powershell
pnpm owner:bootstrap
```

Nhập email và mật khẩu ít nhất 12 ký tự (mật khẩu được ẩn). Nếu báo owner đã tồn tại, dùng tài khoản cũ; không chạy reset DB. Tiếp theo:

```powershell
pnpm dev
```

Giữ terminal này mở. Truy cập `http://localhost:3000/login`, đăng nhập và chọn **Quản lý thiết bị**. Dùng `localhost` nhất quán; đổi sang `127.0.0.1` trên browser sẽ khác Origin.

## 5. Ghép Windows với server

Mở terminal thứ hai tại root, kiểm tra kết nối:

```powershell
pnpm --filter @automation/agent-windows diagnose
```

Trên web `/devices`, bấm **Kết nối máy mới**. Mã có hạn 5 phút và chỉ dùng một lần. Chạy:

```powershell
pnpm --filter @automation/agent-windows pair
```

Agent hiển thị URL server; kiểm tra đúng server của bạn rồi nhập `YES`. Nhập tên máy và mã ở ô nhập ẩn. Không dán mã vào câu lệnh hoặc `.env`. Nếu kho credential đã có từ lần trước, không cần pair lại: chạy `start`. Kho này gắn với tài khoản Windows đã pair.

```powershell
pnpm --filter @automation/agent-windows start
```

Giữ terminal Agent mở. Trong khoảng một chu kỳ cập nhật web, thẻ máy sẽ hiện **Agent online**, lần liên lạc cuối, uptime và RAM. Chọn **Hoạt động và thành viên** để xem các sự kiện pair/kết nối/đổi credential. Số liệu là mẫu đo ở heartbeat cuối, không phải dữ liệu máy được stream liên tục.

## 6. Tự kiểm tra ba tình huống

1. Nhấn Ctrl+C trong terminal Agent: sau hơn 25 giây và lần cập nhật web tiếp theo, máy chuyển **Agent offline**. Khởi động lại `start`: máy online trở lại.
2. Dừng `pnpm dev`: browser báo **chưa rõ trạng thái**, không khẳng định máy đã tắt. Chạy lại `pnpm dev`: web lấy snapshot mới. Backend restart yêu cầu heartbeat mới trước khi coi Agent online.
3. Trên web chọn **Thu hồi thiết bị** và xác nhận: credential bị vô hiệu; Agent dừng khi request tiếp theo bị từ chối. Đây là thao tác thật; nếu muốn ghép lại xem quy trình recovery trong [DEVICES](../DEVICES.md).

## 7. Chia sẻ máy cho người khác (tùy chọn)

Tạo tài khoản thứ hai tại server, nhập mật khẩu ẩn:

```powershell
pnpm user:create
```

Chủ thiết bị mở **Hoạt động và thành viên**, điền email đó, chọn Viewer hoặc Operator rồi **Lưu quyền**. Người nhận đăng nhập bằng browser/profile khác sẽ chỉ thấy máy được chia sẻ hoặc máy do họ tự pair. Ở bước core cả Viewer/Operator đều chỉ xem; chỉ chủ máy được quản lý thành viên và revoke máy. Role OWNER hệ thống không tự cấp quyền xem mọi thiết bị.

## 8. Dùng qua Internet

Khi các bước local đã đạt, làm theo [VPS từng bước](vps-setup.md). Chạy FE/BE/DB trên VPS; đổi `AGENT_API_BASE_URL` trên Windows sang `https://<domain>/api/v1`, đặt `AGENT_ALLOW_LOCAL_HTTP=false`, rồi pair với DB VPS. **Đổi URL server không mang theo quyền từ server cũ.** Dừng Agent và dùng thư mục `AGENT_STATE_DIR` riêng cho VPS để giữ credential local cũ nguyên vẹn.

Nếu thích chạy cả FE/BE trong Docker trên máy phát triển, xem [local-setup](local-setup.md). Khi gặp lỗi, xem [verification](verification.md) và [configuration](configuration.md).
