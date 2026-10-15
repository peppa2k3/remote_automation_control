# CodeGraph — công cụ phát triển

[CodeGraph](https://github.com/colbymchenry/codegraph) 1.6.2 được pin trong devDependencies; `pnpm install --frozen-lockfile` cài CLI cho máy mới. Không cần để sử dụng web/Agent.

Chạy ở root:

```powershell
pnpm codegraph init --yes
pnpm codegraph status
pnpm codegraph explore "DeviceService runHeartbeat"
pnpm codegraph affected backend/src/modules/devices/service.ts --json
pnpm codegraph sync
```

`codegraph.json` loại source tham khảo, generated/build, env và dữ liệu test. `.codegraph/` là index local, không commit hoặc đưa vào Docker context. CLI cần `sync` sau khi sửa; MCP tự watch khi server đang chạy. Không coi graph là bằng chứng code không lỗi hoặc bỏ test khi `affected` rỗng.

SQLite trong `.codegraph/` chỉ là index của công cụ; DB ứng dụng vẫn PostgreSQL. Gói CLI được cài dưới dạng devDependency, không được import vào FE/BE/Agent.

MCP Codex đã cấu hình trong `.codex/config.toml`, chỉ cho workspace này, không đổi config toàn máy. Mở workspace tại root và khởi động lại Codex/extension để nạp server; trong phiên hiện tại dùng CLI. Telemetry tắt trong MCP; CLI có thể tắt bằng `pnpm codegraph telemetry off`. Cấu hình theo [OpenAI Docs](https://developers.openai.com/codex/mcp).

Đợt 026 đã dùng graph để thu hẹp các truy vấn DeviceService (role/fingerprint/email và trường kiểm tra quyền), tránh tải password hash không dùng khi đọc member. Thêm timeout 10 giây cho các thao tác đăng nhập/session. Bằng chứng kiểm tra nằm tại [prompt 026](../completed/026-codegraph-core-review.md).
