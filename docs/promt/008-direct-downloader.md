---
id: "008"
title: "Direct HTTP downloader và bảo vệ URL"
status: PLANNED
depends_on: ["007"]
baseline_task: T06
---

# 008 — Direct HTTP downloader và bảo vệ URL

## Context và mục tiêu

Đọc toàn bộ `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, `docs/CONTEXT_RULES.md`, kiến trúc và module/test liên quan. Mục tiêu: direct http downloader và bảo vệ url. Baseline: T06.

## Phạm vi

Được sửa: agent-windows/src/adapters/downloaders, agent-windows/src/security. Không thay stack, DB shared/production, dịch vụ VPS hiện hữu hoặc module ngoài mục tiêu. Dependencies: 007.

## Input / Output

Input: direct HTTPS URL trên allowlist và giới hạn từ workflow đã validate. Output: stream vào per-run workspace, local relative path, bytes/MIME/checksum và checkpoint resume; không thực thi file.

## Business rules / Security

Validate schema và quyền server-side; không log secret/signed URL. Giữ jobs durable và idempotent, không blind retry publish. Agent outbound, không generic shell. Không deploy hoặc public publish khi chưa được cấp quyền hành động đó. Mock phải có nhãn rõ.

## Acceptance criteria

- [ ] Allowlist + DNS pinning + mọi redirect chặn SSRF/private/metadata/IPv4-mapped IPv6.
- [ ] Streaming timeout, byte quota, disk quota, filename/path safety và SHA-256.
- [ ] Resume chỉ khi Range/ETag hợp lệ; checkpoint phục hồi khi restart.
- [ ] Integration direct HTTPS file hợp lệ và security negative tests pass.
- [ ] Lint/typecheck/test/build liên quan pass và cập nhật docs/env examples.
- [ ] Kết quả, security review, commit reference và nhật ký được cập nhật.

## Kế hoạch kiểm tra

Chạy lint/typecheck/unit/build; bổ sung integration/runtime smoke và negative tests cho acceptance trong scope. Ghi lệnh và kết quả thực. Không đánh dấu external E2E pass từ mock.

## Kết quả thực hiện

Chưa thực hiện. Khi bắt đầu chuyển vào docs/processing, cập nhật status IN_PROGRESS. Ghi files changed, lệnh/kết quả, cấu hình thủ công, giới hạn, security review và commit reference. Chỉ chuyển completed khi toàn bộ gate đạt.

