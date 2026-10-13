---
id: "009"
title: "Media validation và FFmpeg preset"
status: PLANNED
depends_on: ["008"]
baseline_task: T07
---

# 009 — Media validation và FFmpeg preset

## Context và mục tiêu

Đọc toàn bộ `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, `docs/CONTEXT_RULES.md`, kiến trúc và module/test liên quan. Mục tiêu: media validation và ffmpeg preset. Baseline: T07.

## Phạm vi

Được sửa: agent-windows/src/workers/media, file validators. Không thay stack, DB shared/production, dịch vụ VPS hiện hữu hoặc module ngoài mục tiêu. Dependencies: 008.

## Input / Output

Input: file trong per-run workspace, media preset allowlisted và timeout/resources. Output: metadata ffprobe, media đã validate/convert và checksum; invalid/timeout/disk full trả lỗi rõ.

## Business rules / Security

Validate schema và quyền server-side; không log secret/signed URL. Giữ jobs durable và idempotent, không blind retry publish. Agent outbound, không generic shell. Không deploy hoặc public publish khi chưa được cấp quyền hành động đó. Mock phải có nhãn rõ.

## Acceptance criteria

- [ ] ffprobe/FFmpeg argv allowlist, timeout, bounded concurrency và cancellation.
- [ ] MIME sniffing, codec/duration/resolution validation và output checksum.
- [ ] File lỗi bị reject; test file có quyền, chứng minh RAM/CPU giới hạn.
- [ ] Không execute file hoặc shell string từ URL/workflow.
- [ ] Lint/typecheck/test/build liên quan pass và cập nhật docs/env examples.
- [ ] Kết quả, security review, commit reference và nhật ký được cập nhật.

## Kế hoạch kiểm tra

Chạy lint/typecheck/unit/build; bổ sung integration/runtime smoke và negative tests cho acceptance trong scope. Ghi lệnh và kết quả thực. Không đánh dấu external E2E pass từ mock.

## Kết quả thực hiện

Chưa thực hiện. Khi bắt đầu chuyển vào docs/processing, cập nhật status IN_PROGRESS. Ghi files changed, lệnh/kết quả, cấu hình thủ công, giới hạn, security review và commit reference. Chỉ chuyển completed khi toàn bộ gate đạt.

