---
id: "013"
title: "Workflow runner DAG và auto-publish policy"
status: PLANNED
depends_on: ["012"]
baseline_task: T11
---

# 013 — Workflow runner DAG và auto-publish policy

## Context và mục tiêu

Đọc toàn bộ `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, `docs/CONTEXT_RULES.md`, kiến trúc và module/test liên quan. Mục tiêu: workflow runner dag và auto-publish policy. Baseline: T11.

## Phạm vi

Được sửa: packages/workflow-engine, backend/modules/workflows, agent runner. Không thay stack, DB shared/production, dịch vụ VPS hiện hữu hoặc module ngoài mục tiêu. Dependencies: 012.

## Input / Output

Input: workflow JSON schema-versioned (DAG các step allowlisted) và URL items. Output: run/step/jobs/checkpoints tiến tới kết quả publish hoặc NEEDS_ATTENTION; không eval expression/shell.

## Business rules / Security

Validate schema và quyền server-side; không log secret/signed URL. Giữ jobs durable và idempotent, không blind retry publish. Agent outbound, không generic shell. Không deploy hoặc public publish khi chưa được cấp quyền hành động đó. Mock phải có nhãn rõ.

## Acceptance criteria

- [ ] Schema versioned DAG validate cycles/dependencies/step allowlist.
- [ ] Policy auto-publish chỉ chạy với preauthorized source/destination/quota.
- [ ] Một URL -> download -> process -> stage -> publish -> Post ID/link không thêm click.
- [ ] Cancellation, checkpoints, retries và UNKNOWN state giữ đúng state machine.
- [ ] Lint/typecheck/test/build liên quan pass và cập nhật docs/env examples.
- [ ] Kết quả, security review, commit reference và nhật ký được cập nhật.

## Kế hoạch kiểm tra

Chạy lint/typecheck/unit/build; bổ sung integration/runtime smoke và negative tests cho acceptance trong scope. Ghi lệnh và kết quả thực. Không đánh dấu external E2E pass từ mock.

## Kết quả thực hiện

Chưa thực hiện. Khi bắt đầu chuyển vào docs/processing, cập nhật status IN_PROGRESS. Ghi files changed, lệnh/kết quả, cấu hình thủ công, giới hạn, security review và commit reference. Chỉ chuyển completed khi toàn bộ gate đạt.

