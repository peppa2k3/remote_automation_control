# Context rules

- `PROJECT_CONTEXT.md`: phạm vi core hiện tại; `docs/PROJECT_CONTEXT.md` là bản sao giống hệt.
- `ARCHITECTURE.md`: logic/cấu trúc đang triển khai; không trộn tính năng dự kiến.
- `guides/start-here.md`: một luồng chạy local cho máy mới. `guides/vps-setup.md`: bước VPS tiếp theo.
- `archive/automation-baseline.md`: đặc tả cũ để tham khảo, không phải hướng dẫn chạy core.
- `IMPLEMENTATION_LOG.md`: lịch sử append-only; ADR lưu quyết định kỹ thuật.

Prompt có front matter `id`, `title`, `status`, `depends_on`, `baseline_task`; một ID chỉ có một file:

| Thư mục | Trạng thái |
|---|---|
| `docs/promt/` | PLANNED |
| `docs/processing/` | IN_PROGRESS / PARTIAL / BLOCKED |
| `docs/completed/` | DONE, đủ acceptance |

Dependency phải DONE trước khi bắt đầu. Hoàn tất: cập nhật checklist/bằng chứng → chuyển file → append log → commit riêng. Không tự nâng gate Windows 11/VPS từ test khác. `pnpm docs:check` kiểm tra context, ID, dependency và trạng thái.
