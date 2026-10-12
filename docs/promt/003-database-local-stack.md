---
id: "003"
title: "PostgreSQL, migration và stack Docker local"
status: PLANNED
depends_on: ["002"]
baseline_task: T01
---

# 003 — PostgreSQL, migration và stack Docker local

## Context và mục tiêu

Đọc toàn bộ `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, `docs/CONTEXT_RULES.md`, kiến trúc và module/test liên quan. Mục tiêu: postgresql, migration và stack docker local. Baseline: T01.

## Phạm vi

Được sửa: backend/prisma, database integration, infrastructure/compose, CI. Không thay stack, DB shared/production, dịch vụ VPS hiện hữu hoặc module ngoài mục tiêu. Dependencies: 002.

## Input / Output

Input: cấu hình/env và dữ liệu hợp lệ của module; đọc baseline để xác định payload cụ thể. Output: hành vi trong checklist dưới đây, test có bằng chứng và tài liệu đồng bộ.

## Business rules / Security

Validate schema và quyền server-side; không log secret/signed URL. Giữ jobs durable và idempotent, không blind retry publish. Agent outbound, không generic shell. Không deploy hoặc public publish khi chưa được cấp quyền hành động đó. Mock phải có nhãn rõ.

## Acceptance criteria

- [ ] Migrate PostgreSQL 17 local thành công và Prisma write/read/delete pass.
- [ ] Full stack FE/API/DB chạy thật; API ready 200 và FE truy cập được.
- [ ] DB unavailable trả 503, live vẫn 200; migration chạy trước backend.
- [ ] Docker Compose dùng namespace/volume riêng và không đụng container hiện hữu.
- [ ] Lint/typecheck/test/build liên quan pass và cập nhật docs/env examples.
- [ ] Kết quả, security review, commit reference và nhật ký được cập nhật.

## Kế hoạch kiểm tra

Chạy lint/typecheck/unit/build; bổ sung integration/runtime smoke và negative tests cho acceptance trong scope. Ghi lệnh và kết quả thực. Không đánh dấu external E2E pass từ mock.

## Kết quả thực hiện

Chưa thực hiện. Khi bắt đầu chuyển vào docs/processing, cập nhật status IN_PROGRESS. Ghi files changed, lệnh/kết quả, cấu hình thủ công, giới hạn, security review và commit reference. Chỉ chuyển completed khi toàn bộ gate đạt.

