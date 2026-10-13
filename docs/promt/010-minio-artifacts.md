---
id: "010"
title: "MinIO artifact upload và retention"
status: PLANNED
depends_on: ["009"]
baseline_task: T08
---

# 010 — MinIO artifact upload và retention

## Context và mục tiêu

Đọc toàn bộ `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, `docs/CONTEXT_RULES.md`, kiến trúc và module/test liên quan. Mục tiêu: minio artifact upload và retention. Baseline: T08.

## Phạm vi

Được sửa: backend/modules/artifacts, backend/integrations/minio, agent storage worker. Không thay stack, DB shared/production, dịch vụ VPS hiện hữu hoặc module ngoài mục tiêu. Dependencies: 009.

## Input / Output

Input: Agent yêu cầu `/agent/artifacts/presign-upload` với run/job/file metadata có lease hợp lệ. Output: presigned URL ngắn hạn, artifact metadata/checksum trong DB; retention chỉ tác động prefix riêng.

## Business rules / Security

Validate schema và quyền server-side; không log secret/signed URL. Giữ jobs durable và idempotent, không blind retry publish. Agent outbound, không generic shell. Không deploy hoặc public publish khi chưa được cấp quyền hành động đó. Mock phải có nhãn rõ.

## Acceptance criteria

- [ ] Kiểm tra MinIO hiện hữu trước cấu hình, bucket/quota least privilege.
- [ ] Presigned URL scope object/TTL; Agent không nhận permanent/root keys.
- [ ] Checksum, file lớn/resume/multipart, retention và retry an toàn có test.
- [ ] Không xóa object bucket shared; redaction signed URL trong logs.
- [ ] Lint/typecheck/test/build liên quan pass và cập nhật docs/env examples.
- [ ] Kết quả, security review, commit reference và nhật ký được cập nhật.

## Kế hoạch kiểm tra

Chạy lint/typecheck/unit/build; bổ sung integration/runtime smoke và negative tests cho acceptance trong scope. Ghi lệnh và kết quả thực. Không đánh dấu external E2E pass từ mock.

## Kết quả thực hiện

Chưa thực hiện. Khi bắt đầu chuyển vào docs/processing, cập nhật status IN_PROGRESS. Ghi files changed, lệnh/kết quả, cấu hình thủ công, giới hạn, security review và commit reference. Chỉ chuyển completed khi toàn bộ gate đạt.

