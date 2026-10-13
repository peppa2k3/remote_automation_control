---
id: "014"
title: "Alerts, quotas, schedule và cancel/retry"
status: PLANNED
depends_on: ["013"]
baseline_task: T12
---

# 014 — Alerts, quotas, schedule và cancel/retry

## Context và mục tiêu

Đọc toàn bộ `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, `docs/CONTEXT_RULES.md`, kiến trúc và module/test liên quan. Mục tiêu: alerts, quotas, schedule và cancel/retry. Baseline: T12.

## Phạm vi

Được sửa: backend/workers/scheduler, notifications, frontend run actions. Không thay stack, DB shared/production, dịch vụ VPS hiện hữu hoặc module ngoài mục tiêu. Dependencies: 013.

## Input / Output

Input: schedule UTC/timezone, quota config và authenticated cancel/retry action. Output: jobs lên lịch bền vững, audit, notifications và trạng thái rõ; không duplicate sau scheduler restart.

## Business rules / Security

Validate schema và quyền server-side; không log secret/signed URL. Giữ jobs durable và idempotent, không blind retry publish. Agent outbound, không generic shell. Không deploy hoặc public publish khi chưa được cấp quyền hành động đó. Mock phải có nhãn rõ.

## Acceptance criteria

- [ ] Timezone/UTC và lịch bền vững; restart không duplicate scheduled run.
- [ ] Rate quota/cancel/retry có auth/idempotency/audit.
- [ ] Lỗi NEEDS_ATTENTION hiển thị và alert có throttle chống spam.
- [ ] Test token expiry/network/transient/permanent và cancel in-flight.
- [ ] Lint/typecheck/test/build liên quan pass và cập nhật docs/env examples.
- [ ] Kết quả, security review, commit reference và nhật ký được cập nhật.

## Kế hoạch kiểm tra

Chạy lint/typecheck/unit/build; bổ sung integration/runtime smoke và negative tests cho acceptance trong scope. Ghi lệnh và kết quả thực. Không đánh dấu external E2E pass từ mock.

## Kết quả thực hiện

Chưa thực hiện. Khi bắt đầu chuyển vào docs/processing, cập nhật status IN_PROGRESS. Ghi files changed, lệnh/kết quả, cấu hình thủ công, giới hạn, security review và commit reference. Chỉ chuyển completed khi toàn bộ gate đạt.

