# Prompt template

Bắt buộc đọc `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, `docs/CONTEXT_RULES.md`, `docs/ARCHITECTURE.md` và source/test liên quan. Thực hiện một mục tiêu, không đổi stack hoặc mở rộng phạm vi.

Front matter: id NNN, title, status PLANNED, depends_on, baseline_task. Các mục: Context/mục tiêu; Phạm vi; Input/Output; Business rules; Security; Acceptance checklist; Kế hoạch kiểm tra; Kết quả thực (files, tests, cấu hình còn thiếu, giới hạn, commit reference).

Khi DONE, chuyển file sang docs/completed và append docs/IMPLEMENTATION_LOG.md. Khi chưa đạt gate, giữ processing và ghi điều kiện tiếp tục.

