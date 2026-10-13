---
id: "005"
title: "Windows Agent pairing và heartbeat"
status: PARTIAL
depends_on: ["004"]
baseline_task: T03
---

# 005 — Windows Agent pairing và heartbeat

## Context và mục tiêu

Đọc toàn bộ `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, `docs/CONTEXT_RULES.md`, kiến trúc và module/test liên quan. Mục tiêu: windows agent pairing và heartbeat. Baseline: T03.

## Phạm vi

Được sửa: backend/modules/devices, agent-windows/src/core, frontend/features/devices. Không thay stack, DB shared/production, dịch vụ VPS hiện hữu hoặc module ngoài mục tiêu. Dependencies: 004.

## Input / Output

Input: admin tạo pairing code; Agent gửi code + device label/platform/capabilities tới `/agent/pair`, sau đó heartbeat. Output: identity thiết bị, credential scoped và lastSeen/online state; pairing code không tái sử dụng.

## Business rules / Security

Validate schema và quyền server-side; không log secret/signed URL. Giữ jobs durable và idempotent, không blind retry publish. Agent outbound, không generic shell. Không deploy hoặc public publish khi chưa được cấp quyền hành động đó. Mock phải có nhãn rõ.

## Acceptance criteria

- [x] Pair code hết hạn, dùng một lần; device credential riêng với scopes hẹp.
- [x] Heartbeat online/offline, reconnect, revoke và rotate có test.
- [x] Credential Windows lưu DPAPI/Credential Manager, không plaintext env.
- [ ] Không mở inbound; test thật trên Win11 và log không lộ token.
- [x] Lint/typecheck/test/build liên quan pass và cập nhật docs/env examples.
- [x] Kết quả, security review, commit reference và nhật ký được cập nhật.

## Kế hoạch kiểm tra

Chạy lint/typecheck/unit/build; bổ sung integration/runtime smoke và negative tests cho acceptance trong scope. Ghi lệnh và kết quả thực. Không đánh dấu external E2E pass từ mock.

## Kết quả thực hiện

Triển khai 2026-10-13, dependency 004 đã DONE tại `8aced6c`. Kết quả **PARTIAL**: chức năng và các kiểm tra local đã đạt; acceptance test thật trên Win11 chưa đạt vì máy hiện tại là Windows 10 Pro, build 19045. Theo AGENTS.md bước 6, giữ processing đến khi có bằng chứng Win11; không giả lập/chỉ đổi nhãn OS để đánh dấu DONE.

### Thay đổi

- Migration pairing_codes/devices/device_credentials, shared strict schemas; API OWNER list/mint/revoke, native pair/heartbeat/stage/commit. Pair code random 128 bit/TTL 5 phút/one-use; token prefix riêng random 256 bit/TTL 24 giờ, hash-only/scopes heartbeat+rotate. SQL transaction locks và audit bảo vệ pair/revoke/rotation; budgets durable.
- Agent core HTTP client timeout/response bound/no redirect/TLS policy; DPAPI CurrentUser, DACL CurrentUser/SYSTEM, encrypted atomic file, FileShare.None lock. CLI pair nhập mã ẩn, start/heartbeat/rotate; reconnect/backoff, auto rotate và recovery pending token trước network.
- Frontend /devices owner-only, mã một lần giữ trong memory và tự ẩn khi hết hạn, online/offline/revoked polling, revoke; proxy chỉ paths/method cố định, kế thừa Origin/CSRF. Trang home liên kết quản lý thiết bị.
- README, env example, API/database/architecture/security/operations/AUTH, DEVICES và ADR 002; CI Windows DPAPI job và script agent:smoke có kiểm tra OS thật. Chưa chạy CI remote.

### Kiểm tra đã chạy

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`: PASS; 33 unit tests trên Windows gồm backend 16, frontend 7, Agent 8, contracts 2. Test Windows DPAPI thật: encrypt/decrypt, file không token rõ, cạnh tranh process, atomic replace, tamper rejection; test double chỉ dùng trong unit recovery.
- Migration trên DB test riêng và native local: PASS, additive, không reset hoặc sửa .env. `RUN_DB_TESTS=1` + `pnpm --filter @automation/backend test:integration`: 10/10 PASS, gồm 4 device lifecycle tests. SQL thật kiểm tra expired code/consume race, scopes/identity/CSRF negatives, online/offline/reconnect qua clock kiểm soát, device expiry, durable pair budget, pending expiry/restage, commit retry/concurrency và revoke thắng rotation.
- Native smoke Windows 10 trên DB riêng `automation_agent_005_tests`: PASS. Owner frontend proxy tạo code, protected devices HTML/API, pair, DPAPI, CLI heartbeat qua nhiều process, rotate/token cũ 401, stop/restart API → Agent reconnect, revoke → Agent dừng, log không token/code/password. Dọn đúng owner/device/audit/counters test/ciphertext; không tạo credential mặc định trong DB runtime. OS kiểm tra bằng CIM ProductType/build, default agent:smoke không nhận Windows Server/Win10 là Win11 PASS.
- Auth regression smoke không DB/có DB và Agent diagnose: PASS. Native Next CLI báo warning standalone; Docker frontend chạy standalone riêng.
- Docker backend/frontend build PASS; stack local cập nhật, migration exit 0 trước API, API/FE/PG healthy. stack:check PASS; Docker auth/SSR/CSRF/revoke-all regression và ADMIN devices 403/protected devices page PASS. Không Docker hóa Agent hoặc thay container project khác.
- `git diff --check` và docs checker xác nhận context đồng bộ; verification/ciphertext/.env đều ignore.

### Security review và giới hạn

Role/Origin/CSRF quyết định server-side; device bearer không thay admin cookie, browser Origin không được dùng native routes; scopes/capabilities/metadata strict, không command/eval hoặc inbound Agent. Hash domain-separated và không log body/credential; helper DPAPI mã cố định qua pipe, không token trong args/env. Rotation ghi pending local trước side effect, idempotent commit, SQL locks với revoke; không resurrect revoked/expired identity. DACL không thay owner hoặc xin elevation; không plaintext/LocalMachine fallback khi DPAPI thất bại.

Đã kiểm tra native thực trên Win10; **chưa Win11**, chưa Browser visual QA, remote CI, Windows Service/reboot, multi-user/domain DPAPI recovery, production TLS/proxy hoặc provider E2E. Offline vượt credential TTL cần pair lại; lost pair response/storage failure cần owner revoke và phát mã khác. Chưa job claim/result, socket, credential retention/cleanup job hoặc service installer. Các giới hạn có trong DEVICES.md/ADR.

### Điều kiện hoàn tất

Trên Windows 11 với DB test riêng không user/device, chạy hướng dẫn DEVICES.md và `pnpm agent:smoke` (không flag --allow-windows-10). Ghi bằng chứng native pair/DPAPI/restart/rotate/reconnect/revoke/log, đánh dấu acceptance còn lại, rồi chuyển completed và append log mới. Không bắt đầu dependency 006 trước khi gate 005 đạt hoặc có chỉ dẫn trực tiếp thay đổi gate.

Stack hiện chạy tại `http://localhost:3000/devices` (owner đăng nhập). Agent thực dùng `pnpm --filter @automation/agent-windows pair` rồi `start`; không tạo owner/device cá nhân thay người dùng. Commit reference: `feat(005): implement scoped device pairing and DPAPI heartbeat`.
