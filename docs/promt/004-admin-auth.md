---
id: "004"
title: "Admin auth, RBAC, session và kế hoạch MFA"
status: PLANNED
depends_on: ["003"]
baseline_task: T02
---

# 004 — Admin auth, RBAC, session và kế hoạch MFA

## Context và mục tiêu

Đọc toàn bộ `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, `docs/CONTEXT_RULES.md`, kiến trúc và module/test liên quan. Mục tiêu: admin auth, rbac, session và kế hoạch mfa. Baseline: T02.

## Phạm vi

Được sửa: backend/modules/auth, frontend/features/auth. Không thay stack, DB shared/production, dịch vụ VPS hiện hữu hoặc module ngoài mục tiêu. Dependencies: 003.

## Input / Output

Input: email/password tại `POST /api/v1/auth/login`; cookie session tại me/logout/refresh. Output: identity/role, HTTP-only session và audit; CLI bootstrap owner không nhận password trong argument/log.

## Business rules / Security

Validate schema và quyền server-side; không log secret/signed URL. Giữ jobs durable và idempotent, không blind retry publish. Agent outbound, không generic shell. Không deploy hoặc public publish khi chưa được cấp quyền hành động đó. Mock phải có nhãn rõ.

## Acceptance criteria

- [ ] Bootstrap owner qua CLI an toàn; password hash và session server-side.
- [ ] Anonymous bị chặn ở routes nhạy cảm; role checks có negative tests.
- [ ] Cookie HttpOnly/Secure/SameSite, CSRF, brute-force limits và session revoke được test.
- [ ] Ghi kế hoạch MFA, giới hạn nếu chưa triển khai; không log password/session.
- [ ] Lint/typecheck/test/build liên quan pass và cập nhật docs/env examples.
- [ ] Kết quả, security review, commit reference và nhật ký được cập nhật.

## Kế hoạch kiểm tra

Chạy lint/typecheck/unit/build; bổ sung integration/runtime smoke và negative tests cho acceptance trong scope. Ghi lệnh và kết quả thực. Không đánh dấu external E2E pass từ mock.

## Kết quả thực hiện

Chưa thực hiện. Khi bắt đầu chuyển vào docs/processing, cập nhật status IN_PROGRESS. Ghi files changed, lệnh/kết quả, cấu hình thủ công, giới hạn, security review và commit reference. Chỉ chuyển completed khi toàn bộ gate đạt.

