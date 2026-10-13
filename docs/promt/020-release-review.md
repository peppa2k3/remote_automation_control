---
id: "020"
title: "Tổng kiểm tra release và bàn giao"
status: PLANNED
depends_on: ["015"]
baseline_task: NONE
---

# 020 — Tổng kiểm tra release và bàn giao

## Context và mục tiêu

Đọc toàn bộ `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, `docs/CONTEXT_RULES.md`, kiến trúc và module/test liên quan. Mục tiêu: tổng kiểm tra release và bàn giao. Baseline: NONE.

## Phạm vi

Được sửa: docs, tests/e2e, release checklist. Không thay stack, DB shared/production, dịch vụ VPS hiện hữu hoặc module ngoài mục tiêu. Dependencies: 015.

## Input / Output

Input: acceptance checklist MVP, commit/test evidence và vận hành/recovery docs. Output: release readiness report và bàn giao có known issues; đánh dấu gate thiếu rõ ràng.

## Business rules / Security

Validate schema và quyền server-side; không log secret/signed URL. Giữ jobs durable và idempotent, không blind retry publish. Agent outbound, không generic shell. Không deploy hoặc public publish khi chưa được cấp quyền hành động đó. Mock phải có nhãn rõ.

## Acceptance criteria

- [ ] Đối chiếu mọi acceptance MVP với bằng chứng; optional prompts ghi rõ chưa làm.
- [ ] Hướng dẫn setup, vận hành, recovery và credentials không chứa secret.
- [ ] Regression đúng môi trường, thống kê limits và known issues.
- [ ] Không tuyên bố production-ready nếu thiếu real E2E hoặc Meta gate.
- [ ] Lint/typecheck/test/build liên quan pass và cập nhật docs/env examples.
- [ ] Kết quả, security review, commit reference và nhật ký được cập nhật.

## Kế hoạch kiểm tra

Chạy lint/typecheck/unit/build; bổ sung integration/runtime smoke và negative tests cho acceptance trong scope. Ghi lệnh và kết quả thực. Không đánh dấu external E2E pass từ mock.

## Kết quả thực hiện

Chưa thực hiện. Khi bắt đầu chuyển vào docs/processing, cập nhật status IN_PROGRESS. Ghi files changed, lệnh/kết quả, cấu hình thủ công, giới hạn, security review và commit reference. Chỉ chuyển completed khi toàn bộ gate đạt.

