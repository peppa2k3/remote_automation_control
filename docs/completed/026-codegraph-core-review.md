---
id: "026"
title: Cài CodeGraph và tối ưu core
status: DONE
depends_on: ["025"]
baseline_task: NONE
---

# 026 — CodeGraph và rà soát core

## Phạm vi

Cài CodeGraph được pin phiên bản, lập index local chỉ cho source hiện tại, dùng graph để xác định dependency/impact và sửa vấn đề thực tế. Giữ kiến trúc, quyền và dữ liệu; không triển khai tính năng mới.

## Acceptance

- [x] CLI chạy được, graph được tạo và truy vấn thực tế.
- [x] Index loại env/generated/build/source tham khảo/dữ liệu test; index không commit hoặc đưa vào image.
- [x] Cấu hình dùng lại trong workspace, hướng dẫn ngắn.
- [x] Tối ưu có bằng chứng từ graph/code và kiểm tra phù hợp.
- [x] Lint/typecheck/test/build, log và commit riêng; ghi rõ giới hạn.

## Kết quả

- Cài `@colbymchenry/codegraph@1.6.2` devDependency + lockfile, alias `pnpm codegraph`. Không clone source thứ ba vào runtime.
- `codegraph.json` + ignore files giới hạn index; CLI init/status/explore/node/impact/affected/sync đã dùng thật. Index 73 files, 821 nodes, 1.967 edges; kiểm tra danh sách file không chứa env/generated/build/reference/verification.
- `.codex/config.toml` dùng shim local, không cần CLI global; telemetry off/no download fallback. MCP smoke thực: initialize → tools/list → codegraph_explore đọc source hiện tại PASS. IDE cần restart để nạp server trong phiên mới; phiên này dùng CLI.
- Graph chỉ ra caller/test của DeviceService và auth UI. Thu hẹp SELECT role/tokenHash ở list, ownerId/revokedAt/member ở access, email ở members và id/status ở setMember; không tải passwordHash không dùng. Không đổi DTO, quyền, index DB hoặc migration.
- Auth UI login/refresh/logout/revoke-all có timeout 10 giây; giữ nguyên schema/cookie/CSRF và xử lý lỗi sẵn có.
- Files: package/lock, codegraph/MCP config, ignores, DeviceService, 2 auth components, AGENTS/README/guide và prompt/log.

## Kiểm tra

- PASS: lint, typecheck, build, 42 tests (5 script + 37 unit), docs lifecycle/context, local links, diff whitespace.
- PASS: 4 migrations trên PostgreSQL 17 biệt lập, 13 integration tests; auth/SSR/CSRF/session smoke; native Windows 10 DPAPI/restart/rotate/API outage/reconnect/revoke/log smoke. DB test được xóa, PostgreSQL tạm được dừng. Không sửa `.env` thật hoặc DB người dùng.
- Lần test đầu chạy đồng thời với kiểm tra/build khác có 1 DPAPI timeout (`DPAPI_FAILED` thay `STORE_BUSY`); chạy lại full test sau build và native smoke đều PASS. Không tăng timeout hoặc sửa DPAPI để bỏ qua lỗi.

## Giới hạn và bảo mật

Graph còn 5 reference chưa resolve, auth UI không có test component được graph nhận diện; `affected` không thay full checks/runtime. Chưa click-test timeout trên browser thật hoặc benchmark latency/throughput; tối ưu được chứng minh ở phạm vi trường DB đọc và deadline request, không tuyên bố tăng tốc theo tỷ lệ. CLI bundle thêm khoảng 253 MiB dependencies trên Windows x64; chưa đo/build image Docker mới. Chưa nghiệm thu Windows 11/VPS thật, gate 005 giữ nguyên.

Chỉ index local và query source; không đưa env/index lên Git hoặc Docker context, không đổi cấu hình Codex toàn máy. Giữ ranh giới user/device auth, quyền server-side, DPAPI và TLS. DB ứng dụng vẫn PostgreSQL; SQLite chỉ phục vụ index CodeGraph.

Commit reference: `feat(026): add CodeGraph and streamline core queries`.
