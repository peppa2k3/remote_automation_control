# Quy tắc làm việc của AI Agent

Đọc toàn bộ `docs/PROJECT_CONTEXT.md`, `docs/CONTEXT_RULES.md`, `docs/ARCHITECTURE.md`, prompt đang xử lý và mã liên quan trước khi thay đổi. `PROJECT_CONTEXT.md` ở gốc là bản nguồn; bản trong docs phải đồng bộ byte-for-byte. Tài liệu và thông báo dùng tiếng Việt; code, API, schema dùng tiếng Anh.

## Phạm vi và kiến trúc

- Giữ Next.js App Router + Tailwind, Express + Zod, PostgreSQL 17 + Prisma, Agent Node.js native Windows. Node.js 24 LTS.
- VPS là control plane; Agent kết nối outbound. Không mở inbound, generic shell, eval hay thực thi file tải xuống.
- Job/lease/idempotency phải lưu PostgreSQL. Socket.IO chỉ thông báo; polling/REST phục hồi trạng thái.
- Không thêm Redis, n8n, microservice hoặc thay DB nếu prompt không yêu cầu. Quyết định kiến trúc quan trọng cần ADR.
- Auth admin và thiết bị tách riêng. Meta/OAuth secret chỉ tồn tại server-side, được mã hóa. Không đưa vào client/Agent/log/Git.
- SSRF: kiểm tra allowlist, DNS, địa chỉ IP và từng redirect trước khi tải; streaming giới hạn byte, timeout và workspace theo run.
- Public publish phải qua feasibility gate, destination được cấu hình và policy preauthorized. Không blind retry khi kết quả external chưa rõ.

## Quy trình prompt bắt buộc

1. Chọn `docs/promt/NNN-short-name.md` có dependencies đạt; chuyển nguyên file vào `docs/processing/`.
2. Nêu mục tiêu, phạm vi file, dependencies, giả định/rủi ro và kế hoạch kiểm tra ngắn trước khi code.
3. Triển khai phạm vi nhỏ của prompt; giữ thay đổi ngoài scope ở backlog.
4. Chạy `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` và kiểm tra thực tế phù hợp. Không ghi PASS cho lệnh chưa chạy.
5. Cập nhật checklist, files changed, bằng chứng test, cấu hình thủ công, giới hạn, security review và commit reference trong prompt.
6. Chỉ khi acceptance gate đạt mới chuyển vào `docs/completed/`. Nếu thiếu môi trường/quyền, giữ `processing`, ghi PARTIAL/BLOCKED và điều kiện tiếp tục.
7. Sau mỗi prompt hoàn thành, **append** một mục vào `docs/IMPLEMENTATION_LOG.md`; không xóa lịch sử. Ghi việc đã làm, test và giới hạn.
8. Commit riêng từng prompt nếu có Git identity. Prompt ghi commit subject duy nhất; log có thể ghi SHA sau commit (tránh tự tham chiếu SHA trong chính commit).

## An toàn dữ liệu và vận hành

- Không sửa `.env` thật của người dùng, DB production, bucket dùng chung, browser profile hay dữ liệu ngoài workspace của task.
- Chỉ local dev được phép tạo stack/volume riêng theo README. Không deploy VPS hoặc đăng công khai từ yêu cầu bootstrap.
- Không commit secrets, dữ liệu tải về, signed URLs, logs, generated code hoặc build output.
- Validate request bằng schema, authorize server-side, log correlation `requestId/runId/jobId`; không log body chứa secret.
- Không vượt CAPTCHA/MFA/DRM/paywall; không đoán domain, Page ID, token, Traefik network hoặc MinIO hiện hữu.
- Khi làm tích hợp bên ngoài, đọc tài liệu chính thức hiện hành. Mock và kết quả thật phải ghi rõ.
- Không đánh dấu production-ready trước khi kiểm thử hệ thống và provider thật có quyền.

## Kết quả mỗi prompt

Ghi ID/tên, DONE/PARTIAL/BLOCKED, thay đổi, lệnh và kết quả thực, cấu hình còn cần, rủi ro, commit reference và prompt tiếp theo. Kiểm tra `pnpm docs:check` để tránh prompt trùng ID, dependency sai hoặc hai bản context lệch nhau.
