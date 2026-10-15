# Chạy lần đầu trên Windows

Mục tiêu: mở web, pair máy Windows và thấy **Agent online**. Chạy mọi lệnh trong PowerShell tại thư mục gốc dự án. Giữ nguyên cổng mặc định ở lần đầu.

## 1. Cài công cụ

- [Git cho Windows](https://git-scm.com/install/windows) nếu clone source.
- [Node.js](https://nodejs.org/en/download): chọn **24.x**, Windows Installer; mở terminal mới sau khi cài.
- [Docker Desktop cho Windows](https://docs.docker.com/desktop/setup/install/windows-install/): dùng WSL 2 và **Linux containers**; làm theo hướng dẫn cài, khởi động Docker và chờ Engine sẵn sàng.
- Cài pnpm theo phiên bản repo:

```powershell
npm install --global pnpm@11.12.0
node --version
pnpm --version
docker version
```

Kết quả cần có: Node `v24.x`, pnpm `11.12.0`, Docker hiển thị cả **Client** và **Server**. Clone/tải repo rồi mở root có `package.json`; không chạy trong `remote-control-agent-core-base/`.

## 2. Chuẩn bị dự án — một lần

Chạy từng lệnh, chỉ tiếp tục khi lệnh trước thành công:

```powershell
pnpm install --frozen-lockfile
pnpm setup:local
pnpm db:up
pnpm db:migrate
pnpm build
pnpm owner:bootstrap
```

- `setup:local` tạo 4 file env và mật khẩu DB random; giữ nguyên file đã có. Máy mới không cần sửa env.
- `db:up` đợi PostgreSQL healthy trước khi trả về.
- `owner:bootstrap`: nhập email, mật khẩu 12–128 ký tự và xác nhận. Mật khẩu được ẩn; chỉ chạy lần đầu.

## 3. Mở web — terminal 1

```powershell
pnpm dev
```

Giữ terminal mở. Truy cập **http://localhost:3000/login**, đăng nhập và chọn **Quản lý thiết bị**. Dùng đúng `localhost`.

## 4. Kết nối Agent — terminal 2

```powershell
pnpm stack:check
pnpm agent:diagnose
```

Cả hai phải PASS. Trên web `/devices`, bấm **Kết nối máy mới**, sau đó:

```powershell
pnpm agent:pair
```

Kiểm tra URL `http://localhost:4000/api/v1`, nhập `YES`, tên máy, rồi dán mã pair vào ô nhập ẩn và Enter. Mã dùng một lần trong 5 phút. Tiếp theo:

```powershell
pnpm agent:start
```

Giữ terminal Agent mở. Web phải hiện **Agent online**, uptime và RAM sau khoảng 5–10 giây. Credential gắn với tài khoản Windows vừa pair.

## 5. Xác nhận và chạy lại

- Ctrl+C ở Agent: web chuyển offline sau khoảng 25–30 giây. `pnpm agent:start`: online trở lại.
- Dừng web/API: web báo chưa rõ trạng thái. Bật lại `pnpm dev`: Agent tự reconnect, web lấy snapshot mới.
- Khi dùng lại: `pnpm db:up` → `pnpm dev`; mở terminal khác chạy `pnpm agent:start`. Không bootstrap/pair lại mỗi lần.
- Dừng: Ctrl+C ở hai terminal, rồi `pnpm db:stop` nếu muốn dừng DB. Dữ liệu được giữ.

Vậy là hoàn tất local. Để Windows kết nối qua Internet, làm tiếp [VPS](vps-setup.md). Chia sẻ máy/credential: [DEVICES](../DEVICES.md). Gặp lỗi: [verification](verification.md). Các file env/URL: [configuration](configuration.md).
