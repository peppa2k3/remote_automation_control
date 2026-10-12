---
id: "012"
title: "Facebook Page Publisher và reconciliation"
status: PLANNED
depends_on: ["010", "011"]
baseline_task: T10
---

# 012 — Facebook Page Publisher và reconciliation

## Context và mục tiêu

Đọc toàn bộ `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, `docs/CONTEXT_RULES.md`, kiến trúc và module/test liên quan. Mục tiêu: facebook page publisher và reconciliation. Baseline: T10.

## Phạm vi

Được sửa: backend/modules/publishers, backend/workers/reconciler. Không thay stack, DB shared/production, dịch vụ VPS hiện hữu hoặc module ngoài mục tiêu. Dependencies: 010, 011.

## Input / Output

Input: cấu hình/env và dữ liệu hợp lệ của module; đọc baseline để xác định payload cụ thể. Output: hành vi trong checklist dưới đây, test có bằng chứng và tài liệu đồng bộ.

## Business rules / Security

Validate schema và quyền server-side; không log secret/signed URL. Giữ jobs durable và idempotent, không blind retry publish. Agent outbound, không generic shell. Không deploy hoặc public publish khi chưa được cấp quyền hành động đó. Mock phải có nhãn rõ.

## Acceptance criteria

- [ ] Token mã hóa server-side; Page explicit whitelisted, không gửi FE/Agent.
- [ ] Publish fingerprint unique; persist external status và audit trước retry.
- [ ] Timeout response -> UNKNOWN_EXTERNAL_STATUS -> reconcile, không blind retry.
- [ ] Test provider thật có quyền và mock lỗi được phân biệt; feed/photo/video scope rõ.
- [ ] Lint/typecheck/test/build liên quan pass và cập nhật docs/env examples.
- [ ] Kết quả, security review, commit reference và nhật ký được cập nhật.

## Kế hoạch kiểm tra

Chạy lint/typecheck/unit/build; bổ sung integration/runtime smoke và negative tests cho acceptance trong scope. Ghi lệnh và kết quả thực. Không đánh dấu external E2E pass từ mock.

## Kết quả thực hiện

Chưa thực hiện. Khi bắt đầu chuyển vào docs/processing, cập nhật status IN_PROGRESS. Ghi files changed, lệnh/kết quả, cấu hình thủ công, giới hạn, security review và commit reference. Chỉ chuyển completed khi toàn bộ gate đạt.

