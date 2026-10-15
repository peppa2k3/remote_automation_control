# Local Docker toàn bộ stack — tùy chọn

Máy mới nên theo [start-here](start-here.md). Nhánh này thay thế FE/BE native; không chạy cả hai cùng lúc. DB/owner của hai nhánh độc lập.

Sau khi cài dependencies và chạy `pnpm setup:local`:

```powershell
docker compose -f infrastructure/compose/compose.yml --profile stack up --build -d
docker compose -f infrastructure/compose/compose.yml exec backend pnpm owner:bootstrap
pnpm stack:check
```

Mở `http://localhost:3000/login`. Agent vẫn chạy native Windows: `pnpm build`, `pnpm agent:pair`, `pnpm agent:start`. Làm theo bước pair của [start-here](start-here.md).

Dừng stack, giữ dữ liệu:

```powershell
docker compose -f infrastructure/compose/compose.yml --profile stack down
```

Không dùng `down -v` khi muốn giữ DB. Không bootstrap lại nếu owner đã tồn tại.
