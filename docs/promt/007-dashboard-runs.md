---
id: "007"
title: "Dashboard URL, workflow và lịch sử run"
status: PLANNED
depends_on: ["006"]
baseline_task: T05
---

# 007 — Dashboard URL, workflow và lịch sử run

## Context và mục tiêu

Đọc toàn bộ `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, `docs/CONTEXT_RULES.md`, kiến trúc và module/test liên quan. Mục tiêu: dashboard url, workflow và lịch sử run. Baseline: T05.

## Phạm vi

Được sửa: frontend/features/workflows, frontend/features/runs, backend/modules/workflows. Không thay stack, DB shared/production, dịch vụ VPS hiện hữu hoặc module ngoài mục tiêu. Dependencies: 006.

## Input / Output

Input: cấu hình/env và dữ liệu hợp lệ của module; đọc baseline để xác định payload cụ thể. Output: hành vi trong checklist dưới đây, test có bằng chứng và tài liệu đồng bộ.

## Business rules / Security

Validate schema và quyền server-side; không log secret/signed URL. Giữ jobs durable và idempotent, không blind retry publish. Agent outbound, không generic shell. Không deploy hoặc public publish khi chưa được cấp quyền hành động đó. Mock phải có nhãn rõ.

## Acceptance criteria

- [ ] Multi-URL và workflow preconfigured tạo run/jobs transaction có auth.
- [ ] Socket.IO chỉ hint, REST recovery sau reconnect có test.
- [ ] Demo job từ Agent được ghi rõ mock, kết quả/history thật từ DB.
- [ ] Responsive mobile; PWA manifest/icon và offline screen an toàn, không cache private API.
- [ ] Lint/typecheck/test/build liên quan pass và cập nhật docs/env examples.
- [ ] Kết quả, security review, commit reference và nhật ký được cập nhật.

## Kế hoạch kiểm tra

Chạy lint/typecheck/unit/build; bổ sung integration/runtime smoke và negative tests cho acceptance trong scope. Ghi lệnh và kết quả thực. Không đánh dấu external E2E pass từ mock.

## Kết quả thực hiện

Chưa thực hiện. Khi bắt đầu chuyển vào docs/processing, cập nhật status IN_PROGRESS. Ghi files changed, lệnh/kết quả, cấu hình thủ công, giới hạn, security review và commit reference. Chỉ chuyển completed khi toàn bộ gate đạt.

