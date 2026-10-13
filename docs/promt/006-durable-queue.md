---
id: "006"
title: "Job queue durable, lease và idempotency"
status: PLANNED
depends_on: ["005"]
baseline_task: T04
---

# 006 — Job queue durable, lease và idempotency

## Context và mục tiêu

Đọc toàn bộ `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, `docs/CONTEXT_RULES.md`, kiến trúc và module/test liên quan. Mục tiêu: job queue durable, lease và idempotency. Baseline: T04.

## Phạm vi

Được sửa: backend/modules/jobs, agent-windows/src/core. Không thay stack, DB shared/production, dịch vụ VPS hiện hữu hoặc module ngoài mục tiêu. Dependencies: 005.

## Input / Output

Input: jobs đã lưu DB; device gọi claim/ack/renew-lease/progress/complete/fail với lease proof. Output: job thuộc một lease holder, checkpoint/events và trạng thái run; stale/foreign lease bị từ chối.

## Business rules / Security

Validate schema và quyền server-side; không log secret/signed URL. Giữ jobs durable và idempotent, không blind retry publish. Agent outbound, không generic shell. Không deploy hoặc public publish khi chưa được cấp quyền hành động đó. Mock phải có nhãn rõ.

## Acceptance criteria

- [ ] Atomic claim PostgreSQL SKIP LOCKED; concurrent claim không duplicate.
- [ ] Lease renew/complete chỉ holder hợp lệ; expired/stale lease bị từ chối.
- [ ] Retry backoff+jitter có giới hạn và unique idempotency key.
- [ ] Test restart, mất mạng, reclaim, duplicate result và fencing.
- [ ] Lint/typecheck/test/build liên quan pass và cập nhật docs/env examples.
- [ ] Kết quả, security review, commit reference và nhật ký được cập nhật.

## Kế hoạch kiểm tra

Chạy lint/typecheck/unit/build; bổ sung integration/runtime smoke và negative tests cho acceptance trong scope. Ghi lệnh và kết quả thực. Không đánh dấu external E2E pass từ mock.

## Kết quả thực hiện

Chưa thực hiện. Khi bắt đầu chuyển vào docs/processing, cập nhật status IN_PROGRESS. Ghi files changed, lệnh/kết quả, cấu hình thủ công, giới hạn, security review và commit reference. Chỉ chuyển completed khi toàn bộ gate đạt.

