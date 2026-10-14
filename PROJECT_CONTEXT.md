# PROJECT_CONTEXT.md — HOME AUTOMATION CONTROL PLATFORM

## Cập nhật ưu tiên 14/10/2026 — Core quản lý thiết bị

Yêu cầu mới: chuyển logic phù hợp từ `remote-control-agent-core-base` vào dự án đang có, phát triển từ cơ bản lên nâng cao cho người mới. Mục tiêu hiện tại là **Windows local → VPS/server → web manager xem trạng thái và hoạt động thiết bị**. Các mục baseline phía dưới về tải file/publish là định hướng dài hạn, không phải phạm vi core hiện tại.

- Giữ Next.js/Express/Prisma/PostgreSQL, auth cookie/CSRF, DPAPI và rotation đã có; không nhập SQLite/Vite hoặc tạo app thứ hai.
- Tách owner hệ thống và owner theo máy; mỗi máy một owner, nhiều viewer/operator qua membership. Quyền kiểm tra server-side, không có admin bypass ngầm.
- Core dùng REST heartbeat/poll 5 giây, offline sau 25 giây; FE mất server hiển thị unknown và lấy snapshot mới khi phục hồi. API restart yêu cầu heartbeat mới. Hiển thị uptime/RAM/CPU count và audit an toàn.
- Enrollment mã 256-bit/5 phút/one-use, xác nhận URL tại local. Agent outbound, không mở inbound.
- Lease điều khiển pending/ACK, Socket.IO, MeshCentral và allowlist runner là prompt tiếp theo trước mọi hành động điều khiển. Operator ở core chỉ xem. Không nhập shell/eval từ web.
- VPS mẫu một domain HTTPS; ưu tiên proxy hiện hữu. Mẫu Caddy riêng chỉ cho VPS còn trống 80/443. Không deploy thật khi chưa có thông số/quyền; không tự đánh dấu nghiệm thu Windows 11/VPS.
- Lộ trình đang áp dụng: `docs/CORE_ROADMAP.md` và prompt 021–024; hướng dẫn thực hành: `docs/guides/start-here.md`, `docs/guides/vps-setup.md`. ADR 003 ghi quyết định chuyển đổi. Các quyết định và ví dụ env bên dưới là baseline cũ nếu mâu thuẫn với phần này; env mẫu/code hiện tại là nguồn cấu hình thực tế.

---

> **Phiên bản:** 1.0 | **Ngày khởi tạo:** 2026-10-12 | **Trạng thái:** Architecture baseline / chưa triển khai
>
> **Mục đích:** Nguồn ngữ cảnh chính (single source of truth) cho Codex/Copilot/AI Coding Agent, dùng xuyên suốt quá trình phát triển theo từng task. Đọc tài liệu này trước khi thiết kế, sửa code hoặc đề xuất công nghệ.
>
> **Ngôn ngữ làm việc:** Tiếng Việt cho tài liệu, task, thông báo; tiếng Anh cho mã nguồn, API, biến môi trường, schema và định danh.

---

## 0. Tóm tắt dự án và các quyết định đã khóa

### 0.1. Bài toán

Người dùng đã có **VPS và domain**, cùng **một máy Windows 11 tại nhà, RAM 16 GB, dự định bật 24/7**. Người dùng truy cập **website/PWA trên điện thoại hoặc PC**, dán **một hay nhiều URL tải file** và chọn/áp dụng workflow đã cấu hình. Hệ thống tự động:

1. Nhận yêu cầu, xác thực và lưu job.
2. Chuyển job đến **Windows Agent tại nhà** qua kết nối do Agent chủ động tạo đến VPS.
3. Download file từ URL hợp lệ và nguồn có quyền truy cập; kiểm tra file, hash, MIME, dung lượng, trùng lặp.
4. Tùy workflow: đổi tên, phân loại, dùng FFmpeg tạo video phù hợp, tạo caption theo mẫu/AI, upload trung gian nếu cần.
5. **Đăng nội dung lên Facebook Page (Fanpage do người dùng quản lý, tạm gọi là “Trang Vàng”)** thông qua API chính thức khi được cấp quyền; hỗ trợ YouTube trong phase sau.
6. Lưu trạng thái/log/link bài đăng, thông báo thành công/thất bại; tự retry có kiểm soát.

**Kết quả mong muốn:** Cấu hình và cấp quyền một lần; các lần sau người dùng **chỉ dán URL và bấm Gửi**, không duyệt từng bước. Workflow đủ điều kiện được tự chạy đến khi hoàn tất. Ngoại lệ khách quan (token hết hạn, MFA, nội dung bị từ chối, nguồn không truy cập được) được ghi nhận và cảnh báo, không tìm cách vượt xác thực.

### 0.2. Quyết định kỹ thuật mặc định

| Hạng mục | Công nghệ/chính sách mặc định | Ghi chú |
|---|---|---|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS, PWA | Một website dùng tốt trên điện thoại; không làm app Android native ở MVP |
| Backend điều phối | Node.js bản LTS được hỗ trợ, TypeScript, Express, Zod | REST API và quản lý quyền/quy trình |
| Realtime Dashboard | Socket.IO | **Chỉ báo sự kiện**, không là queue bền vững |
| Database + queue MVP | PostgreSQL 17 + Prisma + SQL transaction | Job bền vững; claim bằng transaction/`FOR UPDATE SKIP LOCKED` khi cần |
| Windows Agent | Node.js + TypeScript chạy native Windows | **Không Docker hóa Agent GUI**; cấu hình chạy nền tự khởi động |
| Browser Worker | Playwright + Chromium | Ưu tiên headless cho việc được phép; headful chỉ khi cần |
| Xử lý multimedia | FFmpeg/ffprobe | Hạn chế RAM, CPU và số worker đồng thời |
| Object storage | **Tận dụng MinIO đang có trên VPS nếu kiểm tra thấy phù hợp** | File sau xử lý, ảnh chụp, artifact; không bắt buộc ở task kết nối đầu tiên |
| Reverse proxy | Traefik hiện có trên VPS + HTTPS/Let's Encrypt | Dùng network Traefik hiện hữu, tránh cấu hình lại cả VPS |
| CI/CD | GitHub Actions + Docker registry + Docker Compose | VPS nhận image đã build; Windows Agent cập nhật riêng có xác minh |
| Facebook | Meta Graph API / Pages API | Chỉ Fanpage có quyền quản lý; API là đường chính |
| YouTube (tương lai) | YouTube Data API + OAuth2 | Module provider độc lập |
| Điều khiển desktop từ xa | RustDesk hoặc giải pháp remote có xác thực (tùy chọn) | Dành cho cứu hộ thủ công, **không** là đường chạy workflow chính |
| Redis/BullMQ, n8n, AI model | **Chưa bắt buộc ở MVP** | Chỉ thêm khi có số liệu chứng minh nhu cầu |

**Lý do chọn PostgreSQL thay MongoDB đời cũ:** Người dùng từng vận hành MongoDB 4.x vì hạn chế AVX trên máy chủ. MongoDB 4.x đã hết vòng đời hỗ trợ; **không nâng cấp/đụng vào DB đang dùng cho dự án khác**. PostgreSQL cung cấp transactions và job claiming phù hợp, tránh phụ thuộc yêu cầu AVX của MongoDB bản mới. Nếu môi trường có MongoDB phiên bản còn được hỗ trợ và muốn đổi DB, cần tạo ADR (Architecture Decision Record) trước; **không tự đổi công nghệ khi chưa có task**.

### 0.3. Thông tin đang chờ cấu hình — không được tự đoán

- Tên miền thực tế và subdomain cho ứng dụng.
- Cấu hình VPS (CPU, RAM, dung lượng, hệ điều hành), đường dẫn deploy, Traefik network/certresolver, tên compose stack hiện tại.
- Dung lượng đĩa trên Windows 11, tốc độ upload Internet tại nhà, chính sách điện/mạng khi mất kết nối.
- Meta App ID, Page ID thực tế, loại bài (ảnh, video feed, Reels), tình trạng quyền API/App Review.
- Loại URL nguồn (link file trực tiếp, Drive, website riêng, v.v.) và quyền tải/sử dụng lại nội dung.
- MinIO hiện có: endpoint, bucket, version, quota, quyền truy cập và tình trạng dịch vụ.

**Quy tắc:** Tất cả giá trị trên phải đi qua `.env` / settings / cấu hình mã hóa; chỉ dùng `example.com` hay `<PLACEHOLDER>` trong ví dụ. **Không hard-code thông tin vận hành thật.**

---

## 1. Phạm vi MVP và ngoài phạm vi

### 1.1. MVP bắt buộc

- Đăng nhập quản trị; chỉ chủ sở hữu được tạo workflow/publish mặc định; ưu tiên MFA.
- Một Windows Agent đăng ký theo luồng pairing có mã ngắn hạn và khóa thiết bị, heartbeat online/offline.
- Dashboard: nhập một/nhiều URL, chọn workflow, xem hàng đợi, lịch sử, log, kết quả.
- Task queue bền vững; Agent mất mạng/PC restart không mất job; không thực thi trùng.
- URL Downloader plugin cho **file HTTP(S) trực tiếp trên host được phép**.
- Validate file, checksum SHA-256, kích thước, MIME, tên an toàn; local workspace riêng theo run.
- FFmpeg validation/convert đơn giản, có timeout và giới hạn concurrent job.
- Facebook Page publisher qua API chính thức **chỉ sau khi chứng minh được quyền cấp token và upload test**.
- Auto-publish theo workflow được chủ tài khoản kích hoạt trước, chỉ với Page đã khai báo; có dry-run, rate-limit, chống đăng trùng và audit log.
- Thống kê SUCCESS/FAILED/NEEDS_ATTENTION, link bài đăng, retry thủ công và retry có kiểm soát.
- Docker Compose deploy cho API/Frontend/Postgres trên VPS (tái dùng MinIO/Traefik nếu có).
- Test tối thiểu: unit, integration và 1 end-to-end thực tế có kiểm soát.

### 1.2. Không nằm trong MVP

- Điều khiển chuột/bàn phím qua browser realtime kiểu TeamViewer do ta tự viết.
- Tự động vượt CAPTCHA, MFA, chống bot, DRM, paywall hoặc tải nội dung không được phép.
- Facebook profile cá nhân, group, hàng loạt fanpage khách hàng khi chưa xác minh API và quyền.
- AI tự quyết định nội dung đăng hoặc tự thay đổi destination mà người dùng chưa cấu hình.
- Hệ thống đa tenant, Kubernetes, microservices phức tạp hoặc mở shell tùy ý từ Internet.
- Browser automation để né giới hạn/điều khoản của nền tảng; ưu tiên API công khai được phép.

---

## 2. Kiến trúc hệ thống

```mermaid
flowchart TD
  U[Điện thoại / PC Browser\nNext.js PWA] <-->|HTTPS| T[Traefik / TLS trên VPS]
  T --> F[Next.js Frontend]
  T --> B[Express API + Socket.IO]
  F -->|API HTTPS, authenticated| B
  B <-->|Prisma| DB[(PostgreSQL\nJobs / Runs / Config / Audit)]
  B <-->|S3 SDK| S[(MinIO\nArtifacts / Media)]
  B -->|Meta Graph API / OAuth| M[Facebook Page]
  B -.->|future| Y[YouTube API]
  W[Windows 11 Agent 24/7\nNative Node.js] -->|outbound HTTPS\nclaim / heartbeat / result| B
  B -.->|optional wake hint via WSS| W
  W --> DL[Downloader + Validators]
  W --> FF[FFmpeg Worker]
  W --> PW[Playwright Worker]
  W <-->|presigned HTTPS URLs| S
  D[RustDesk optional] -.-> W
```

### 2.1. Phân chia trách nhiệm theo máy

**Trên VPS (public qua Traefik, nhưng nội bộ chỉ API/FE mở route):**
- Frontend Next.js, backend Express, PostgreSQL; MinIO nếu đã có và được phép dùng chung.
- Backend là nguồn sự thật duy nhất về jobs/runs/status, workflow config, destinations, authentication, audit và API credentials.
- Server-side Facebook publisher gọi Meta API từ VPS; **Page access token giữ trên VPS và mã hóa khi lưu**.
- Chỉ Traefik nhận 80/443; DB, internal API và MinIO admin không public bừa bãi.

**Trên Windows 11 tại nhà:**
- `agent-core`: tiến trình background, tự reconnect, xác thực thiết bị, heartbeat, claim, lease renewal, thực thi job không phụ thuộc GUI.
- `browser-worker`: chạy Playwright trong user session khi cần tương tác giao diện hoặc trình duyệt có profile.
- `file-worker`: download, checksum, phân loại, upload artifacts.
- `media-worker`: ffprobe/FFmpeg, tạo thumbnail, kiểm tra đầu ra.
- Thư mục dữ liệu riêng (ví dụ `D:\\AutomationData` hoặc đường dẫn cấu hình), không scan/ghi đè hệ thống tùy ý.
- Không cần inbound public port, NAT/port forwarding hay expose RDP.

**Tách Service và GUI:** Windows Service không được truy cập trực tiếp desktop phiên người dùng. Bước cần UI phải chạy bằng một **user-session worker** có phiên đăng nhập thích hợp. Nếu không có phiên tương tác, workflow GUI trả `WAITING_FOR_SESSION`, còn workflow headless vẫn chạy được.

### 2.2. Đường truyền và bảo mật kết nối

1. Browser -> `https://app.<YOUR_DOMAIN>` -> Traefik -> Frontend.
2. Frontend -> `https://api.<YOUR_DOMAIN>/api/v1` -> Traefik -> Express.
3. Windows Agent -> **outbound** `https://api.<YOUR_DOMAIN>/api/v1/agent/*`, đăng nhập bằng device credential xoay vòng, được gán scopes `agent:claim`, `agent:heartbeat`, `agent:result`.
4. Socket.IO WSS để đẩy cập nhật Dashboard; Agent có thể nghe tín hiệu `jobs.available` nhưng **phải luôn fallback polling**.
5. Backend -> DB qua private Docker network.
6. Agent <-> MinIO qua **pre-signed URL ngắn hạn**, chỉ đối tượng cụ thể; không phát permanent MinIO root credentials cho Agent.
7. Backend -> Meta Graph API qua HTTPS, lưu secret trên VPS; Agent không biết Meta access token.

**Tài khoản:** Admin và Agent là **hai identity khác nhau**; không dùng token người dùng cho Agent. Có chức năng revoke thiết bị, rate-limit, log mọi yêu cầu nhạy cảm và rotate secret.

---

## 3. Luồng chạy end-to-end

### 3.1. Happy path: Một URL -> Một bài Fanpage

```mermaid
sequenceDiagram
  participant User as Web/PWA
  participant API as VPS API
  participant DB as PostgreSQL
  participant Agent as Win11 Agent
  participant Storage as MinIO
  participant Meta as Facebook API
  User->>API: POST /workflows/:id/runs {urls}
  API->>DB: INSERT run + jobs (transaction)
  API-->>User: 202 {runId}
  Agent->>API: POST /agent/jobs/claim
  API->>DB: Atomic claim + lease
  API-->>Agent: job + signed config (không chứa Meta token)
  Agent->>Agent: Download + validate + SHA256
  Agent->>Agent: FFmpeg / metadata / captions (nếu cấu hình)
  Agent->>API: POST progress + renew lease
  Agent->>Storage: PUT artifact via presigned URL
  Agent->>API: POST job complete {artifactKey, checksum}
  API->>DB: Persist artifact + create publish job
  API->>Storage: Stream artifact
  API->>Meta: Publish Page post using server-side credential
  Meta-->>API: Post ID / status
  API->>DB: Store publication ID + result
  API-->>User: Realtime status + post URL (nếu có)
```

### 3.2. Khi offline, timeout hoặc restart

- Tất cả job được ghi DB **trước** khi phát sự kiện; socket không chứa tác vụ duy nhất.
- Agent claim bằng atomic DB transaction qua backend, nhận `leaseExpiresAt`; heartbeat gia hạn lease khi đang chạy.
- Sau restart, Agent truy vấn trạng thái run chưa kết thúc và **tiếp tục/khôi phục từ checkpoint an toàn**.
- Lease hết hạn: server chuyển job sang pending sau khi xác minh chưa hoàn thành; không khởi tạo 2 upload đồng thời.
- Upload Meta có kết quả **UNKNOWN** khi mất response: kiểm tra published post / upload session trước khi thử lại. **Không blind retry publish**, vì có thể đăng trùng.
- `FAILED_RETRYABLE` (network/timeout/transient) khác `FAILED_PERMANENT` (quyền API sai, nguồn cấm, file không hợp lệ).
- Chính sách retry có exponential backoff và jitter, số lần cấu hình. Không retry vô hạn; chống spam.

### 3.3. Các trạng thái đề xuất

- `PENDING` -> `CLAIMED` -> `RUNNING` -> `SUCCEEDED`.
- Nhánh phụ: `WAITING_FOR_AGENT`, `WAITING_FOR_SESSION`, `WAITING_FOR_STORAGE`, `NEEDS_ATTENTION`, `RETRY_SCHEDULED`, `FAILED`, `CANCEL_REQUESTED`, `CANCELED`, `UNKNOWN_EXTERNAL_STATUS`.
- Run/Step/Publication có trạng thái riêng; status được chuyển theo state machine có test, không gán tùy ý.

### 3.4. Giao diện thao tác tối thiểu

- Mặc định trang tạo Run chỉ có: **dán URL (nhiều dòng)**, chọn **workflow có sẵn** (lần sau nhớ mặc định), nút **Bắt đầu**.
- Settings cho quyền sở hữu file, target Page, lịch, template, quota, auto-publish (cấu hình một lần).
- Dashboard hiển thị: Agent online/offline; tổng job; đang tải/đang xử lý/đang đăng; tỷ lệ thành công; lỗi cần chú ý.
- Mỗi Run: file gốc, artifact, step logs, errors, Facebook Post ID/link, nút retry/cancel, lịch sử audit.
- Mobile PWA có responsive UI; không cần app native.

---

## 4. Các module phải tách rời (plugin architecture)

### 4.1. Downloader adapters

`DownloaderAdapter` có contract: `supports(source)`, `probe(url)`, `download(input, context)`, `verify(output)`.

- `DirectHttpDownloader` cho HTTP(S) direct file (MVP); HEAD nếu hỗ trợ, fallback GET; stream file, timeout, retry, resume có xác thực ETag/Range.
- `GoogleDriveDownloader` (later): chỉ dùng Drive API / quyền hợp lệ; không tự giả định share link luôn tải được.
- `SiteSpecificDownloader` (later): mỗi website là adapter được kiểm tra về quyền tải/điều khoản, không xây crawler tổng quát giả mạo đăng nhập.
- Không cố vượt DRM/CAPTCHA, giới hạn truy cập hay tải lại nội dung không có quyền.

### 4.2. Processors

- `FileValidationProcessor`: size, extension, MIME sniffing, checksum, virus scan nếu cần, filename sanitize.
- `MediaProcessor`: ffprobe, FFmpeg, kiểm tra audio/video duration, codec, resolution, aspect ratio; preset riêng cho feed/Reels.
- `CaptionTemplateProcessor`: placeholder `{filename}`, `{date}`, custom text.
- `AICaptionProcessor` (optional): tích hợp provider qua backend, model key ở VPS, kết quả theo policy/template và có flag bật/tắt; không đăng nội dung AI chưa có quyền sử dụng.
- `ArtifactStorageProcessor`: upload object lên MinIO, retention policy.

### 4.3. Publishers

- `FacebookPagePublisher` (MVP sau feasibility spike): Page text/photo/video; Reels là task riêng, chỉ mở khi đã kiểm thử API tương ứng.
- `YouTubePublisher` (later): OAuth2, resumable upload, metadata/status, lịch và xử lý quota.
- `CustomWebPublisher` (later): Playwright chỉ khi website cho phép tự động hóa, có adapter selector/version, screenshot debug, không bypass protection.
- Interface publisher chung: `validateAccount()`, `validateContent()`, `publish()`, `getStatus()`, `resolvePublishedUrl()`.
- Target account là explicit `destinationId` đã được whitelisted; AI không được tự chọn hoặc thay đổi.

### 4.4. Desktop / Remote Access

- Dùng RustDesk hoặc tương đương cho **remote cứu hộ thủ công** nếu cần; bật MFA/quyền truy cập/allowlist, không công khai credential.
- `DesktopWorker` cho thao tác GUI trên Windows là **plugin tùy chọn phase sau**, tách khỏi Agent Core.
- Tác vụ hệ thống: chỉ predefined commands/parameters với allowlist, timeout, sandbox quyền hạn. **Không có endpoint chạy shell tự do.**

---

## 5. Database schema/records — logic tối thiểu

Dùng UUID; timestamps UTC; hiển thị timezone `Asia/Ho_Chi_Minh` ở UI. Mọi bảng/collection có `createdAt`, `updatedAt` khi hợp lý.

| Entity | Trường chính |
|---|---|
| `users` | id, email, passwordHash/OIDC subject, role, mfaEnabled, status |
| `devices` | id, label, platform, credentialFingerprint, capabilities, lastSeenAt, onlineState, revokedAt |
| `workflow_definitions` | id, name, version, isActive, stepsJson (schema-versioned), destinationId, autoPublishPolicy, limits |
| `workflow_runs` | id, workflowId, workflowVersion, createdBy, inputJson, status, progress, startedAt, finishedAt |
| `jobs` | id, runId, stepKey, assignedDeviceId, type, payloadJson, status, attempt, maxAttempts, idempotencyKey, leaseTokenHash, leaseExpiresAt, nextRunAt |
| `artifacts` | id, runId, jobId, objectKey/localRelativePath, sourceUrlRedacted, fileName, mimeType, bytes, sha256, retentionUntil |
| `destinations` | id, provider, name, externalAccountId, capabilityFlags, enabled |
| `provider_credentials` | id, destinationId, encryptedSecret, tokenExpiresAt, version, needsReconnect (không trả API) |
| `publications` | id, runId, destinationId, artifactId, externalPostId, externalUrl, status, publishFingerprint, lastCheckedAt |
| `job_events` | id, jobId, type, safePayloadJson, timestamp (append-only) |
| `audit_logs` | id, actorType, actorId, action, targetType, targetId, metadataRedacted, createdAt |

**Ràng buộc:**
- Unique `jobs(runId, stepKey, inputItemKey)`; unique `publications(destinationId, publishFingerprint)` hoặc thiết kế tương đương để chống đăng trùng.
- Index `jobs(status, nextRunAt)`, `jobs(assignedDeviceId, leaseExpiresAt)`, `workflow_runs(createdAt)`, `artifacts(sha256)`.
- Không đặt DB transaction kéo dài trong khi download hoặc gọi API bên ngoài.
- `claim` phải atomic; process publish nên giữ external id/state để reconcile khi mất response.
- `ProviderCredential` được mã hóa ở application layer bằng key từ secret manager/env, **không gửi về Frontend/Agent**.

---

## 6. API và realtime contracts dự kiến

Base route: `/api/v1`. Response chuẩn `{ success, data, error, requestId }`; validation bằng Zod; pagination cursor/limit; chuẩn hóa code lỗi.

### Web/Admin API

```text
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
GET    /auth/me
GET    /devices
POST   /devices/pairing-code
POST   /devices/:deviceId/revoke
GET    /workflow-definitions
POST   /workflow-definitions
PUT    /workflow-definitions/:id
POST   /workflow-definitions/:id/runs
GET    /runs?status=&cursor=
GET    /runs/:runId
POST   /runs/:runId/cancel
POST   /runs/:runId/retry
GET    /runs/:runId/events
GET    /destinations
POST   /destinations/facebook/connect
GET    /destinations/facebook/callback
POST   /destinations/:id/disconnect
GET    /health/live
GET    /health/ready
```

### Windows Agent API (được authorize bằng device identity)

```text
POST   /agent/pair
POST   /agent/heartbeat
POST   /agent/jobs/claim
POST   /agent/jobs/:id/ack
POST   /agent/jobs/:id/renew-lease
POST   /agent/jobs/:id/progress
POST   /agent/jobs/:id/complete
POST   /agent/jobs/:id/fail
POST   /agent/artifacts/presign-upload
GET    /agent/config
```

### Socket.IO events

`device.online`, `device.offline`, `run.created`, `run.updated`, `job.progress`, `job.failed`, `publication.published`, `publication.needs_attention`.

- Mọi events có `eventId`, `timestamp`, `runId`/`jobId`, `version` và payload đã loại bí mật.
- Dashboard reconnect phải gọi lại REST API để reconcile state; không coi Socket.IO là message queue.
- Server -> Agent chỉ gửi wake hint nếu cần; Agent claim qua REST với lease.

### Ví dụ HTTP request khởi chạy

```json
{
  "workflowId": "<UUID_OF_PRECONFIGURED_WORKFLOW>",
  "items": [
    {"sourceUrl": "https://files.example.com/video-01.mp4"},
    {"sourceUrl": "https://files.example.com/video-02.mp4"}
  ],
  "requestIdempotencyKey": "user-supplied-uuid-or-client-generated-uuid"
}
```

**Không cho frontend gửi arbitrary pipeline code, PowerShell, JS hoặc đích Facebook mới chưa được cấu hình.** Chỉ tham chiếu các `workflowId` / destination đã được admin khai báo và policy chấp nhận.

---

## 7. Workflow schema mẫu: cấu hình trước, nhập link chạy sau

```json
{
  "schemaVersion": 1,
  "name": "Download, validate and publish to my Facebook Page",
  "enabled": true,
  "targetDeviceId": "<HOME_WINDOWS_AGENT_UUID>",
  "destinationId": "<MY_FACEBOOK_PAGE_DESTINATION_UUID>",
  "input": {"type": "url-list", "maxItemsPerRun": 10},
  "policy": {
    "autoPublish": true,
    "requireManualApproval": false,
    "contentRightsConfirmed": true,
    "allowedSourceHosts": ["files.example.com"],
    "maxFileSizeMB": 1024,
    "maxConcurrentDownloads": 2,
    "maxConcurrentPublishes": 1,
    "maxPublicationsPerDay": 5,
    "dryRun": false
  },
  "steps": [
    {"id": "download", "type": "download.direct_http", "timeoutSeconds": 3600},
    {"id": "validate", "type": "file.validate", "dependsOn": ["download"]},
    {"id": "prepare", "type": "media.prepare", "dependsOn": ["validate"], "preset": "facebook-feed"},
    {"id": "caption", "type": "caption.template", "dependsOn": ["prepare"], "template": "{filename}"},
    {"id": "store", "type": "artifact.stage", "dependsOn": ["caption"]},
    {"id": "publish", "type": "facebook.page.publish", "dependsOn": ["store"]},
    {"id": "notify", "type": "notify.dashboard", "dependsOn": ["publish"]}
  ]
}
```

**Quan trọng:** Mẫu trên là **định dạng thiết kế**, không phải script tự chạy. Số lượng, dung lượng và quota là **giới hạn vận hành nội bộ minh họa**, không phải giới hạn Meta. AI Agent phải tạo JSON Schema/Zod và executor cho từng step; không thực thi biểu thức động không an toàn. `contentRightsConfirmed` chỉ thể hiện xác nhận của chủ workflow và không thay thế điều khoản/bản quyền thực tế.

**Quy tắc auto-publish:** Người dùng bật chế độ này một lần sau khi đã cấp quyền Page, chọn nguồn và duyệt template; sau đó mỗi run hợp lệ tự chạy. Không yêu cầu xác nhận từng file. Mọi nội dung ngoài policy, token hết hạn, độ tin cậy không đủ hoặc API từ chối -> `NEEDS_ATTENTION` và thông báo, **không tự động vượt rào**.

---

## 8. Cấu trúc monorepo mục tiêu

```text
home-automation-platform/
├── frontend/                      # Next.js App Router, Tailwind, PWA
│   ├── src/app/
│   ├── src/components/
│   ├── src/features/{auth,devices,workflows,runs,artifacts,destinations}/
│   ├── src/lib/api/
│   ├── tests/
│   ├── Dockerfile
│   └── .env.example
├── backend/                       # Express + Socket.IO + Prisma
│   ├── src/app.ts
│   ├── src/server.ts
│   ├── src/modules/{auth,devices,workflows,jobs,artifacts,publishers,audit}/
│   ├── src/workers/{scheduler,publisher,reconciler}/
│   ├── src/integrations/{minio,facebook,youtube}/
│   ├── src/middleware/
│   ├── prisma/{schema.prisma,migrations}/
│   ├── tests/{unit,integration,e2e}/
│   ├── Dockerfile
│   └── .env.example
├── agent-windows/                 # Node.js + TS, native Win11 process
│   ├── src/core/{connection,auth,heartbeat,claim,runner}/
│   ├── src/adapters/downloaders/
│   ├── src/workers/{file,media,browser,desktop}/
│   ├── src/security/
│   ├── scripts/{install,uninstall,update}/
│   ├── tests/
│   └── .env.example
├── packages/
│   ├── contracts/                 # Shared Zod schema + TypeScript DTO
│   ├── workflow-engine/           # Steps, DAG runner, state machine
│   └── common/                    # Error types, logging interfaces
├── infrastructure/
│   ├── compose/{compose.yml,compose.prod.yml}
│   ├── scripts/{deploy,backup,restore,smoke-test}.sh
│   └── env/.gitkeep               # Không commit secret thực
├── docs/
│   ├── PROJECT_CONTEXT.md         # Đồng bộ nội dung của file này
│   ├── ARCHITECTURE.md
│   ├── SECURITY.md
│   ├── DATABASE.md
│   ├── API.md
│   ├── OPERATIONS.md
│   ├── ADR/
│   └── prompts/{planned,in-progress,completed}/
├── .github/workflows/{ci.yml,deploy-production.yml,build-agent.yml}
├── AGENTS.md
├── pnpm-workspace.yaml
├── package.json
├── .gitignore
└── README.md
```

**Coding conventions:** pnpm workspaces, TypeScript strict, ESLint, Prettier, Zod validation, structured JSON logs (Pino), centralized error handler, UTC storage, Vitest/Jest theo lựa chọn đồng nhất, Playwright E2E. Không cần Nx/Turborepo ở MVP trừ khi có lý do cụ thể.

---

## 9. Deployment và vòng đời 24/7

### VPS

- Docker Compose quản lý `frontend`, `backend`, `postgres` (và MinIO nếu chưa có); tách internal network và external Traefik network.
- Kết nối Traefik hiện hữu **theo đúng network và certresolver đang cấu hình thực tế**. Không tự giả định `web` là tên network khi chưa xác minh, dù VPS có thể đã dùng network này.
- HTTPS, redirect HTTP->HTTPS, headers phù hợp, websocket upgrade, CORS allowlist.
- Healthcheck `/health/live` + `/health/ready`, restart policy, resource limits, DB migrations trước khi traffic chuyển sang phiên bản mới.
- Backup PostgreSQL và cấu hình, đối tượng MinIO tùy chính sách; test restore định kỳ.
- CI/CD: lint -> unit/integration -> build image -> scan cơ bản -> push registry -> backup/migrate -> deploy -> smoke test -> rollback app nếu lỗi. **Không rollback schema DB phá dữ liệu.**
- Tránh làm thay đổi hay downtime các stack production khác trên VPS.

### Windows 11

- **Agent Core** cài dưới dạng Windows Service chạy bằng tài khoản ít quyền nhất có thể; bảo đảm tự chạy khi máy reboot dù không đăng nhập.
- **GUI Worker** là ứng dụng riêng chạy bằng tài khoản Windows thông thường trong user session; có thể tự khởi động bằng Task Scheduler **Run only when user is logged on** (không bảo đảm tương tác GUI nếu chưa logon).
- Đối với download/direct API/upload file và FFmpeg, ưu tiên headless, không cần phiên desktop để chạy 24/7.
- Windows Power Settings: sleep off; ổ cứng đủ chỗ; Windows Update và lịch reboot được quản lý; UPS tùy môi trường; BIOS restore AC power khi được hỗ trợ.
- Tùy chọn restart service khi crash, backoff reconnect, log rotation, giới hạn số worker, Disk Cleanup an toàn.
- Agent update: artifact có chữ ký hoặc checksum + nguồn đáng tin, có rollback, không nhận binary/script tự do từ task.

### MinIO/File pipeline

- File gốc tải và xử lý ở Windows local. Sau khi xử lý, Agent xin pre-signed upload từ Backend và push artifact lên MinIO (theo HTTPS), Backend thực hiện publish.
- Điều này có **chi phí băng thông outbound ở nhà + inbound/outbound VPS** và cần đủ disk; không tải lại file qua Frontend/browser.
- Bucket/prefix riêng cho ứng dụng; lưu metadata trên DB, file bytes trên local disk/MinIO, không nhét blob lớn vào DB.
- Nếu video quá lớn, nghiên cứu multipart/resumable uploads và stream trực tiếp, kiểm tra timeout/ingress upload limits; không cố tải cả video vào RAM 16GB.
- Xác định TTL cho file gốc / artifact / log; xóa theo retention policy và không xóa dữ liệu ngoài workspace.

---

## 10. Security invariants (không được vi phạm)

1. Không expose Windows Agent, RDP, SSH, PowerShell remoting, PostgreSQL hoặc MinIO console ra public network không cần thiết.
2. Không có generic endpoint `executeCommand`, `eval`, upload-chạy `.ps1/.exe/.bat` từ URL hoặc browser-script injection.
3. Chỉ URL `https://` (cho phép `http://` qua policy có lý do), giới hạn domain/source adapter; cấm `file:`, `ftp:`, loopback, private/link-local/reserved IP, cloud metadata; **kiểm tra DNS và mọi redirect** để chống SSRF cả ở VPS và Windows Agent.
4. Giới hạn download size, streaming byte count, HTTP timeout, redirect count, file type, disk quota, process memory/CPU, số job đồng thời; không tin `Content-Length` hay phần mở rộng.
5. Cấm path traversal; sanitize file names; thư mục per-run; không tự động overwrite/delete tệp người dùng ngoài workspace.
6. Xác thực user bằng cookie HTTP-only Secure SameSite thích hợp hoặc cơ chế tương đương; chống CSRF cho cookie auth; chống brute-force; RBAC theo vai trò.
7. Agent có định danh/credential riêng, scope hẹp, pair/revoke/rotate; certificate validation bắt buộc; token exp ngắn, không log token.
8. OAuth token Meta/Google chỉ lưu server-side có mã hóa + khóa cấu hình riêng; secrets không commit, không đưa vào client bundles hoặc log; có refresh/re-auth flow khi provider hỗ trợ.
9. Validate tất cả workflow config bằng schema + server-side authorization. Không nhận function expressions, shell strings hay URL destination động vượt policy.
10. Giới hạn publish rate do người dùng cấu hình + tuân thủ quota/ToS provider; chống double publish; mọi bài đăng có audit trail.
11. Không sử dụng thuật toán để vượt CAPTCHA, MFA, DRM, throttling hay hạn chế truy cập.
12. Trước khi bật workflow mới: dry-run, thử nghiệm với nội dung có quyền sở hữu, xác nhận đúng Page. Hạn chế nghiêm ngặt cho publish công khai.
13. Agent chỉ cập nhật từ nguồn phát hành đáng tin cậy; kiểm soát dependency và signature/checksum.
14. Giải pháp remote desktop tùy chọn phải tách biệt hoàn toàn khỏi kênh Agent nhiệm vụ và có MFA.

---

## 11. Các cấu hình môi trường cần có (không chứa giá trị bí mật)

### Backend (`backend/.env.example`)

```dotenv
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://USER:PASSWORD@postgres:5432/automation
FRONTEND_ORIGIN=https://app.example.com
PUBLIC_API_BASE_URL=https://api.example.com
AUTH_SESSION_SECRET=<RANDOM_SECRET>
ENCRYPTION_KEY=<BASE64_32_BYTE_KEY>
AGENT_PAIRING_SECRET=<RANDOM_SECRET>
S3_ENDPOINT=https://storage.example.com
S3_REGION=us-east-1
S3_BUCKET=automation-artifacts
S3_ACCESS_KEY_ID=<APP_SCOPED_ACCESS_KEY>
S3_SECRET_ACCESS_KEY=<APP_SCOPED_SECRET>
META_APP_ID=<META_APP_ID>
META_APP_SECRET=<META_APP_SECRET>
META_GRAPH_API_VERSION=<VERIFY_SUPPORTED_VERSION>
META_REDIRECT_URI=https://api.example.com/api/v1/destinations/facebook/callback
LOG_LEVEL=info
```

### Frontend (`frontend/.env.example`)

```dotenv
NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api/v1
NEXT_PUBLIC_SOCKET_URL=https://api.example.com
NEXT_PUBLIC_SITE_URL=https://app.example.com
API_INTERNAL_BASE_URL=http://backend:4000/api/v1
```

> `NEXT_PUBLIC_*` được Next.js đưa vào client build khi được sử dụng; cấu hình CI build theo domain target, không nhét secret vào `NEXT_PUBLIC_*`.

### Windows Agent (`agent-windows/.env.example`)

```dotenv
AGENT_API_BASE_URL=https://api.example.com/api/v1
AGENT_DEVICE_ID=<PAIRED_DEVICE_ID>
AGENT_CREDENTIAL_PATH=C:\\ProgramData\\HomeAutomationAgent\\credential.json
AGENT_DATA_DIR=D:\\AutomationData
AGENT_LOG_LEVEL=info
AGENT_MAX_CONCURRENT_DOWNLOADS=2
AGENT_MAX_CONCURRENT_MEDIA_JOBS=1
AGENT_HEARTBEAT_SECONDS=30
AGENT_POLL_SECONDS=10
```

> Chứng thực Agent lưu bằng Windows DPAPI/Credential Manager hoặc vùng bảo vệ tương đương; không đưa token thực vào `.env` public, bản build hay git.

---

## 12. Kế hoạch phát triển theo phase và task nhỏ

**Nguyên tắc:** Task phải chạy được, test được, có commit riêng; tuyệt đối không giao cho AI viết toàn bộ production trong một prompt. Các task đánh dấu phụ thuộc; chỉ bắt đầu phase tiếp theo khi exit criteria phase trước đạt.

| Task | Tên và scope | Acceptance gate |
|---|---|---|
| `T00` | Repo bootstrap + monorepo + tooling + AGENTS.md | `pnpm lint/typecheck/test` pass, CI scaffold |
| `T01` | Docker Compose VPS local dev + Postgres + Prisma + health endpoints | FE/API/DB kết nối; migration và health hoạt động |
| `T02` | Auth + role + session + MFA planning | Chặn anonymous; auth tests pass; không lộ secret |
| `T03` | Pair Windows Agent + device identity + heartbeat | Win11 online/offline, reconnect, revoke, logs |
| `T04` | DB-backed job queue, claim/lease/retry/idempotency | Tắt mạng/restart vẫn giữ job, không duplicate |
| `T05` | Dashboard nhập URL, workflows và run history | Multi-URL -> jobs; realtime progress + REST recovery |
| `T06` | Direct HTTP downloader trên Agent | Stream lớn, resume safe, checksum, URL security tests |
| `T07` | Media validation + FFmpeg preset | File không hợp lệ bị từ chối, no memory spike |
| `T08` | MinIO signed artifact upload + retention | Transfer được file lớn, không lộ root key |
| `T09` | **Meta Facebook feasibility spike** | Test Page token/permissions + đăng 1 bài vào Page được chỉ định và lấy post ID; ghi tài liệu nếu bị chặn |
| `T10` | Facebook Page Publisher + status reconciliation | API-driven publishing, no blind retry, audit log |
| `T11` | Workflow runner (DAG steps + auto-publish policy) | 1 URL -> publish -> logged URL; zero extra click sau setup |
| `T12` | Alerts, quotas, scheduling, cancel/retry | Rate policy đúng, thông báo lỗi, không spam |
| `T13` | E2E hardening + backup/restore + deployment | Reboot Win/VPS, net loss, full regression pass |
| `T14` | Browser Worker / approved website adapters | Headless flow test trong website cho phép |
| `T15` | AI caption + provider integrations (optional) | Human-defined policy, config secrets, fallback |
| `T16` | YouTube publisher (optional) | OAuth, resumable upload, metadata, link result |
| `T17` | Optional GUI Worker + RustDesk integration docs | GUI only when session available; remote safe |

**Ưu tiên rủi ro:** Làm `T09` sớm ở dạng một **spike độc lập** ngay sau bootstrap/auth tối thiểu để xác nhận Meta API không bị chặn bởi quyền/App Review. Không để đến cuối dự án mới kiểm chứng khả năng đăng bài.

### Các mốc release

- **Milestone A — Connection:** `T00–T05`: website tạo job, Agent claim và trả kết quả demo (mock).
- **Milestone B — Files:** `T06–T08`: nhập URL -> tải/biến đổi/stage artifact thật.
- **Milestone C — Facebook:** `T09–T11`: một bài trên Page thật với quyền đã cấp, auto-publish theo rule.
- **Milestone D — Stable 24/7:** `T12–T13`: thử lỗi mạng, restart, logging, security, CI/CD.
- **Milestone E — Expansion:** `T14–T17`: nguồn phức tạp, AI, YouTube và GUI desktop.

---

## 13. Quy tắc bắt buộc dành cho AI Coding Agent

1. Trước mỗi task, đọc **toàn bộ** `docs/PROJECT_CONTEXT.md`, `AGENTS.md`, task file và code hiện hành liên quan.
2. Trả về trước khi code: mục tiêu task, files sẽ sửa, dependencies, risks, assumptions, kế hoạch test ngắn; không thay đổi ngoài scope.
3. Không tự ý thêm microservices, queue mới, đổi database, đổi API path, tái kiến trúc/reformat toàn project nếu task không yêu cầu.
4. Mọi task phải có unit/integration tests tương ứng, validation/authorization và cập nhật docs cần thiết.
5. Không sửa/bỏ `.env` thực, DB production hoặc MinIO bucket dùng chung; không chạy migration phá dữ liệu.
6. Không commit secrets, real tokens, dữ liệu cá nhân, browser profiles, video/file thật, log chứa signed URLs.
7. Khi thiếu quyền Facebook/YouTube, tạo adapter interface và mock/test có ranh giới rõ; **không tự tuyên bố chức năng production thành công**.
8. Phân biệt code mẫu, mock, staging và production; không fake kết quả integration E2E.
9. Task kết thúc phải chạy lint, typecheck, tests, build phù hợp (nêu lệnh và kết quả thực chạy).
10. Cập nhật task markdown: checklist, files changed, tests, limitations, security review, commit SHA; chỉ chuyển `planned` -> `completed` khi acceptance gate pass.
11. Không tự deploy production, xóa dữ liệu, đăng công khai hoặc update Windows Agent thật khi task chưa cấp quyền thực thi hành động đó.
12. Giữ source rõ ràng, testable, dependency injection và interfaces cho providers/workers; log có `requestId/runId/jobId`.
13. Khi tích hợp nền tảng bên thứ ba, kiểm tra **tài liệu API hiện hành** (version, quyền, quota, endpoints, hạn chế) trước khi code.
14. Mọi thay đổi kiến trúc quan trọng phải thêm `docs/ADR/ADR-XXXX.md` kèm lý do và migration plan.

### Quy trình xử lý một prompt

`READ CONTEXT -> INSPECT REPO -> PLAN -> IMPLEMENT MINIMUM SCOPE -> TEST -> SECURITY REVIEW -> UPDATE DOCS -> COMMIT -> SUMMARY`

Yêu cầu kết quả AI cuối task:

```text
Task ID / Tên:
Trạng thái: DONE | BLOCKED | PARTIAL
Files changed:
Lệnh test và kết quả:
Những chỗ phải cấu hình thủ công (không có secret):
Rủi ro / việc chưa làm:
Commit SHA:
Task gợi ý tiếp theo:
```

---

## 14. Template tạo TASK/PROMPT tính năng mới

Lưu mỗi task tại `docs/prompts/planned/TXX-short-name.md` rồi đưa nguyên đoạn sau cho Codex:

```markdown
# TASK TXX — <TÊN TÍNH NĂNG>

## Project context
Bắt buộc đọc `docs/PROJECT_CONTEXT.md`, `AGENTS.md` và các module liên quan trước khi code.

## Mục tiêu
<Một mục tiêu có thể kiểm thử.>

## Phạm vi
- Được sửa: <folder/files/module>
- Không được sửa: <folder/files/module>

## Input/Output
- Input: <payload, UI action, scheduler trigger>
- Output: <DB state, API response, file artifact, provider link>

## Business rules
- <rules và validation>
- <quy tắc auto/approval, deadline, retry/idempotency>

## Security / Data safety
- Không làm lộ key/token; giới hạn permissions.
- Không phá hoặc sửa dữ liệu production ngoài task.
- Không cho thực thi lệnh hệ thống tùy ý.

## Acceptance criteria
- [ ] <case thành công>
- [ ] <case lỗi>
- [ ] <case mất mạng/restart/duplicate nếu liên quan>
- [ ] Unit/integration tests pass
- [ ] Build/typecheck/lint pass
- [ ] Docs/API/.env.example cập nhật

## Hướng dẫn triển khai
1. Đọc source hiện tại, kiểm tra code có sẵn tránh làm trùng.
2. Lập kế hoạch thay đổi ngắn rồi triển khai đúng scope.
3. Chạy test thực tế; không giả lập thành công khi chưa có credentials.
4. Tóm tắt thay đổi, hạn chế, commit SHA.
5. Khi đủ tiêu chí, chuyển prompt sang `docs/prompts/completed/`.
```

### Prompt khởi động đầu tiên dành cho AI Agent

```text
Bạn là Senior Full-stack / DevOps Engineer phát triển Home Automation Control Platform.
Đọc toàn bộ docs/PROJECT_CONTEXT.md; coi đây là bản đặc tả gốc. Bắt đầu TASK T00
(repo bootstrap), chưa viết module nghiệp vụ khác. Triển khai monorepo pnpm gồm
frontend Next.js + Tailwind, backend Express + Prisma, agent-windows Node.js TS,
packages/contracts, Docker Compose cho dev, .env.example, AGENTS.md,
README và CI lint/typecheck/test/build. Không hard-code domain/secret.
Không triển khai VPS thật, không tác động hệ thống khác, không thêm Redis/n8n.
Sau khi làm, chạy các kiểm tra, liệt kê kết quả thực tế và commit.
```

---

## 15. Definition of Done — thành công phải được chứng minh

Một tính năng coi là hoàn tất khi:

- Chạy được trên môi trường phù hợp, không chỉ compile.
- Giao thức giữa FE–BE–DB–Agent có validation, test và tương thích version.
- Các đường lỗi chính (offline, timeout, token invalid, duplicate, disk full) được xử lý và hiển thị rõ.
- Có structured log + request correlation; không để secret trong output.
- Auth, permission checks, URL filtering và quota đã áp dụng.
- Docs và `.env.example` đồng bộ; không để config local cứng trong code.
- Data migration có phương án an toàn và backup/restore nếu cần.
- Với external API (Meta/YouTube), có **test thực trên tài khoản được cấp quyền** mới được đánh dấu production-ready.
- Có bằng chứng test/commit, không viết `[x]` cho hạng mục chưa xác minh.

### E2E acceptance quan trọng nhất của toàn dự án

**Given:** Windows Agent đang online, workflow preauthorized trỏ đúng Fanpage, nguồn tải hợp lệ và có quyền, token còn hiệu lực.

**When:** người dùng mở PWA, dán 1 URL, nhấn Gửi.

**Then:** không phải tương tác thêm; job được lưu DB -> Agent tải file -> validate/process -> stage artifact -> backend đăng lên Page -> status SUCCESS kèm post ID/link. Restart Agent trong lúc download không mất dữ liệu; mất callback publish không tạo post trùng.

---

## 16. Các rủi ro cần xác minh sớm

| Rủi ro | Kiểm chứng/biện pháp |
|---|---|
| Meta permission/App Review/API endpoints thay đổi | Spike `T09`, test Page thực bằng app thuộc quyền người dùng; version-pin và document kết quả |
| URL tải là trang cần đăng nhập/không phải file | Bắt đầu direct HTTPS link; adapter riêng theo nguồn và quyền được cấp |
| Upload file lớn qua VPS/MinIO tốn bandwidth | Đo dung lượng và tốc độ thật; multipart/resumable và retention; xem xét dịch pipeline khi cần |
| Máy nhà ngủ hoặc Windows Update reboot | Agent Service + Sleep off + recover/resume/heartbeat |
| Windows Service không click được GUI | Tách headless workers và interactive session worker |
| Duplicate post khi timeout | Publish fingerprint, persisted external status, reconciliation, no blind retry |
| DB hiện hữu không tương thích/unsupported | Stack PostgreSQL mới độc lập, không ảnh hưởng DB cũ |
| Dữ liệu nguồn không có quyền đăng lại | Chỉ dùng nội dung sở hữu/được phép; validate chính sách và điều khoản nền tảng |
| VPS storage/network yếu | Kiểm tra profile máy và file size trước khi chọn cấu hình lưu trữ |
| API quota và throttling | Rate policy bảo thủ, backoff, thẻ cảnh báo và giảm concurrency |

---

## 17. Tham khảo chính thức (phải kiểm tra bản mới khi code)

- Socket.IO delivery guarantees: https://socket.io/docs/v4/delivery-guarantees/
- Playwright downloads: https://playwright.dev/docs/downloads
- Playwright input files: https://playwright.dev/docs/input
- Microsoft Interactive Services / Session 0: https://learn.microsoft.com/en-us/windows/win32/services/interactive-services
- Meta for Developers: https://developers.facebook.com/docs/
- Meta Graph API docs: https://developers.facebook.com/docs/graph-api/
- YouTube videos.insert: https://developers.google.com/youtube/v3/docs/videos/insert
- PostgreSQL SKIP LOCKED: https://www.postgresql.org/docs/current/sql-select.html
- Prisma ORM: https://www.prisma.io/docs
- AWS S3 presigned uploads concepts (MinIO S3-compatible): https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html

**Lưu ý:** Đây là thiết kế mục tiêu, không xác nhận Meta đã cấp quyền hay môi trường triển khai đã sẵn sàng. Không tự động giả định mọi link tải hoặc mọi định dạng bài đăng đều được Facebook/YouTube chấp nhận.

---

## 18. Các nguyên tắc không thay đổi trừ khi người dùng yêu cầu

1. **Một thao tác đầu vào:** dán danh sách link và nhấn Gửi; quy trình còn lại tự chạy nếu preauthorized.
2. **Máy ở nhà là Worker, VPS là Control Plane.** Không phụ thuộc remote desktop thủ công.
3. **Security-first** nhưng công nghệ tinh gọn; tái sử dụng hạ tầng có sẵn khi an toàn.
4. **API first** cho Facebook Page/YouTube; browser fallback chỉ trong phạm vi được phép.
5. **Local Agent không nghe Internet inbound.** Lệnh đều phải được xác thực, có schema và audit.
6. **Job durable và idempotent.** Không đăng bài trùng do retry.
7. **Develop feature-by-feature với task và acceptance gates.** AI Coding Agent không được tự mở rộng phạm vi.
8. **Không làm hỏng bất kỳ dự án nào đang chạy trên VPS**, database hoặc MinIO dùng chung.
9. **Không khẳng định production-ready trước khi chạy test ngoài đời.**

**Bắt đầu triển khai:** Copy file này vào `docs/PROJECT_CONTEXT.md` của repository, tạo `AGENTS.md` để trỏ tới tài liệu, rồi giao `T00` cho AI Coding Agent. Khi có thông số VPS/domain/Meta App chính thức, bổ sung vào tài liệu triển khai/`.env` bảo mật, **không sửa các quyết định kiến trúc chỉ vì thiếu dữ liệu ban đầu**.
