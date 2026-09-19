# 测评结果收集与管理后台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将学生测评提交、服务端计分与持久化、机构管理员检索和可打印报告接入现有元能力测评应用。

**Architecture:** 保留 Vite + React 的学生测评和 `Report` 视觉组件；新增一个 Node 24 HTTP 服务，使用内置 `node:sqlite` 保存数据。学生端仅提交原始作答，服务端校验并调用现有报告领域逻辑创建不可变报告快照；管理员通过受 Cookie 保护的 API 和 React 管理端读取、重新生成及打印记录。

**Tech Stack:** React 18、TypeScript、Vite 6 SSR build、Node.js 24 `http`/`crypto`/`node:sqlite`、Vitest、Testing Library、`tsx`（本地运行服务端）。

**Spec:** `docs/superpowers/specs/2026-09-10-assessment-collection-admin-design.md`

## Global Constraints

- 不改变五项元能力、题库、分类算法和学生报告的现有视觉语言。
- 所有正式分数、支持状态、学科与任务分类必须由服务端重新计算；不接受客户端传来的分数或报告。
- 学生端新增必填中国大陆 11 位手机号；手机号不参与评分。
- 手机号不能出现在 URL、浏览器本地存储、日志、OSS 静态文件或管理端列表的完整字段中。
- 管理端只有机构内部管理员可用；会话 Cookie 必须是 `HttpOnly`、`SameSite=Lax`，生产环境必须附带 `Secure`。
- 使用 Node 24 内置 SQLite；数据库、备份和所有密钥不提交到仓库。
- 未提交成功时保留学生本地作答并可重试；不显示“已保存”。
- 继续使用现有 300–500 分模拟场景验证服务端报告与领域逻辑一致。

---

## 文件结构

| 路径 | 职责 |
| --- | --- |
| `server/config.ts` | 环境变量、端口、数据库和 Cookie 配置的解析与启动期校验 |
| `server/security.ts` | 手机号规范化、HMAC 检索摘要、AES-GCM 加解密、管理员密码校验和签名会话 |
| `server/database.ts` | SQLite schema、连接、Assessment repository 和测试数据库构造 |
| `server/score-assessment.ts` | 服务端任务响应验证、判分、证据构建和 `ReportModel` 生成 |
| `server/api.ts` | HTTP 路由、JSON/Cookie/CORS、学生提交和管理员接口 |
| `server/index.ts` | 服务端入口、静态文件托管和优雅关闭 |
| `server/*.test.ts` | Node 环境下的安全、持久化、计分与 API 集成测试 |
| `src/lib/api-client.ts` | 学生端和管理端调用 API 的类型安全客户端 |
| `src/lib/session.ts` | 保存手机号、远端提交状态和最后一次提交 payload；不保存报告分数 |
| `src/components/IntakeScreen.tsx` | 新增手机号输入与前端格式校验 |
| `src/App.tsx` | 提交原始完成快照、失败重试、仅展示服务端返回的报告 |
| `src/admin/*` | 管理员登录、记录列表、记录详情和打印页面 |
| `src/AdminApp.tsx` | `/admin` 路径的 React 管理端路由壳 |
| `src/main.tsx` | 依据 pathname 渲染学生端或管理端 |
| `src/styles.css` | 与现有报告同体系的管理端、提交状态和打印样式 |
| `src/components/Report.tsx` | 支持管理端打印来源信息，不改变报告算法/正文层级 |
| `.env.example` | 所有必填环境变量的无秘密示例 |
| `scripts/create-admin-credentials.mjs` | 生成密码摘要和随机密钥，仅输出到终端 |
| `vite.config.ts` | 本地 `/api` 代理与服务端生产构建配置 |
| `package.json` | 服务端开发、构建、启动和测试脚本 |
| `README.md` | 本地启动、环境变量、备份、部署和打印操作说明 |

## Task 1: 服务端基础、安全原语与 SQLite 仓储

**Files:**
- Create: `server/config.ts`
- Create: `server/security.ts`
- Create: `server/database.ts`
- Create: `server/security.test.ts`
- Create: `server/database.test.ts`
- Create: `server/test-helpers.ts`
- Create: `.env.example`
- Create: `scripts/create-admin-credentials.mjs`
- Modify: `package.json`
- Modify: `vitest.config.ts`

**Interfaces:**
- Produces `loadServerConfig(env): ServerConfig`, `createSecurity(config): SecurityService`, `openDatabase(path): AssessmentDatabase`.
- `SecurityService` exposes `normalizePhone(phone)`, `phoneLookupHash(phone)`, `encryptPhone(phone)`, `decryptPhone(ciphertext)`, `createSession(username, now)`, and `verifySession(token, now)`.
- `AssessmentDatabase` exposes `createAssessment(input)`, `findAssessments(query)`, `findAssessmentById(id)`, and `replaceReportSnapshot(id, snapshot)`.

- [ ] **Step 1: Add Node-oriented development dependencies and scripts**

Add `tsx` and `@types/node` as development dependencies. Add these scripts while retaining existing scripts:

```json
{
  "dev:server": "tsx watch server/index.ts",
  "build:server": "vite build --ssr server/index.ts --outDir dist-server",
  "start:server": "node dist-server/index.js",
  "test:server": "vitest run server"
}
```

Set `environmentMatchGlobs` in `vitest.config.ts` so every `server/**/*.test.ts` test uses `node`, while existing `src` tests retain `jsdom`.

- [ ] **Step 2: Write failing security tests**

Create `server/security.test.ts` with tests for:

```ts
it('normalizes and validates a mainland mobile number', () => {
  expect(normalizePhone(' 138 0013 8000 ')).toBe('13800138000')
  expect(() => normalizePhone('123')).toThrow('手机号格式不正确')
})

it('creates stable lookup hashes but decryptable encrypted values', () => {
  const security = createSecurity(testConfig)
  expect(security.phoneLookupHash('13800138000')).toBe(security.phoneLookupHash('138 0013 8000'))
  expect(security.decryptPhone(security.encryptPhone('13800138000'))).toBe('13800138000')
})

it('rejects a changed or expired session token', () => {
  const token = security.createSession('admin', new Date('2026-09-10T00:00:00Z'))
  expect(security.verifySession(token, new Date('2026-09-10T01:00:00Z'))?.username).toBe('admin')
  expect(security.verifySession(`${token}x`, new Date('2026-09-10T01:00:00Z'))).toBeNull()
  expect(security.verifySession(token, new Date('2026-09-11T00:00:01Z'))).toBeNull()
})
```

- [ ] **Step 3: Run security tests to verify they fail**

Run: `pnpm vitest run server/security.test.ts`

Expected: FAIL because `server/security.ts` does not yet export the tested interfaces.

- [ ] **Step 4: Implement secure configuration and primitives**

Implement `loadServerConfig` to require non-empty `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, `PHONE_ENCRYPTION_KEY`, and `PHONE_LOOKUP_SECRET` outside test mode. Use AES-256-GCM with a 12-byte random IV for phone encryption; serialize `iv.ciphertext.authTag` as base64url segments. Use HMAC-SHA-256 for the lookup hash and a constant-time comparison for both password and session signatures. Use `crypto.scryptSync` password records in the exact `scrypt$N$r$p$salt$derivedKey` format. Sign a base64url JSON payload `{ username, exp }` with HMAC-SHA-256 and set 8-hour expiry.

Provide `.env.example` with non-secret keys and explanatory comments. Implement `scripts/create-admin-credentials.mjs` to request a password from `ADMIN_PASSWORD` environment input and print a compatible hash plus three randomly generated base64url secrets; it must not create `.env` or write secrets to disk.

- [ ] **Step 5: Run security tests to verify they pass**

Run: `pnpm vitest run server/security.test.ts`

Expected: PASS.

- [ ] **Step 6: Write failing SQLite repository tests**

Create `server/database.test.ts` that opens `:memory:` and verifies:

```ts
const id = db.createAssessment({
  studentName: '王同学', phoneEncrypted: 'encrypted', phoneLookupHash: 'hash', grade: '高三',
  foreignLanguage: '英语', selectedSubjects: ['物理'], responses: [{ position: 1 }],
  report: { conclusion: 'test' }, versions: { bank: '1.6', scoring: '1.6', mapping: '1.6' }, completedAt: iso,
})
expect(db.findAssessments({ page: 1, pageSize: 20, name: '王' }).items[0]).toMatchObject({ id, studentName: '王同学', phoneMasked: '138****8000' })
expect(db.findAssessments({ page: 1, pageSize: 20, phoneLookupHash: 'hash' }).total).toBe(1)
expect(db.findAssessmentById(id)?.responses).toEqual([{ position: 1 }])
```

- [ ] **Step 7: Run repository tests to verify they fail**

Run: `pnpm vitest run server/database.test.ts`

Expected: FAIL because `openDatabase` and its repository methods are absent.

- [ ] **Step 8: Implement schema and repository**

Use `node:sqlite` `DatabaseSync`. Create `assessments` with `TEXT` primary key, encrypted/hash phone columns, version columns, JSON payload columns, report revision, timestamps and status. Create indexes for `completed_at`, `student_name` and `phone_lookup_hash`. Enable `foreign_keys` and WAL only for a file-backed database. Parameterize every statement. Parse JSON only after a valid row is fetched. The list query must return masked phone (`first 3 + "****" + last 4`) and never return `phone_encrypted`; the detail query may return it for server-side decryption.

- [ ] **Step 9: Run repository tests to verify they pass**

Run: `pnpm vitest run server/database.test.ts`

Expected: PASS.

- [ ] **Step 10: Commit the foundation**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts .env.example scripts/create-admin-credentials.mjs server
git commit -m "feat: add secure assessment persistence foundation"
```

## Task 2: 服务端判分与学生提交 API

**Files:**
- Create: `server/score-assessment.ts`
- Create: `server/score-assessment.test.ts`
- Create: `server/api.ts`
- Create: `server/api.assessments.test.ts`
- Create: `server/index.ts`
- Modify: `src/lib/transport.ts`

**Interfaces:**
- Consumes `AssessmentDatabase`, `SecurityService`, `assessmentTasksV16`, `buildPrototypeReport`.
- Produces `scoreSubmission(payload): { evidence: ScoredEvidence[]; report: ReportModel; intake: Intake }`.
- Produces `createApiServer(dependencies): http.Server` with `POST /api/assessments`.
- Replaces client-only score adapter with `ApiAssessmentClient.submitAssessment(payload): Promise<SubmittedAssessment>`.

- [ ] **Step 1: Write failing server scoring tests**

Build a complete valid payload from existing V1.6 task fixtures. Assert:

```ts
const result = scoreSubmission(validPayload)
expect(result.evidence).toHaveLength(assessmentTasksV16.length)
expect(result.report.dimensionSummary).toHaveLength(5)
expect(() => scoreSubmission({ ...validPayload, responses: validPayload.responses.slice(1) })).toThrow('作答不完整')
expect(() => scoreSubmission({ ...validPayload, responses: [{ ...validPayload.responses[0], response: { kind: 'multi-choice', answers: { '0': 'not-an-option' } } }, ...validPayload.responses.slice(1)] })).toThrow('选项无效')
```

- [ ] **Step 2: Run scoring tests to verify they fail**

Run: `pnpm vitest run server/score-assessment.test.ts`

Expected: FAIL because `scoreSubmission` does not exist.

- [ ] **Step 3: Implement the authoritative scorer**

Move answer-key scoring into `server/score-assessment.ts`; import the V1.6 bank only on the server. Validate every response against the known task at the matching position and use its expected answer to construct `ScoredEvidence`. Do not read any supplied client score, classification or report. Validate name, grade, foreign language, selected subjects and phone. Derive report subjects exactly as `App.tsx` does, then call `buildPrototypeReport`. Return the original normalized intake plus evidence and the report.

Remove answer-key imports from `src/lib/transport.ts`. Keep the existing `AssessmentTransport` types only when a client component needs them; no production client bundle may include `META_BANK_V16` answers or an answer key.

- [ ] **Step 4: Run scoring tests to verify they pass**

Run: `pnpm vitest run server/score-assessment.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing student-submit API tests**

Create `server/api.assessments.test.ts` using an in-memory database and a test server. Test:

```ts
const response = await request(server, 'POST', '/api/assessments', validPayload)
expect(response.status).toBe(201)
expect(response.body).toMatchObject({ assessmentId: expect.any(String), report: expect.any(Object) })
expect(db.findAssessments({ page: 1, pageSize: 10 }).total).toBe(1)
expect(response.body).not.toHaveProperty('phone')
expect((await request(server, 'POST', '/api/assessments', { ...validPayload, phone: '1' })).status).toBe(400)
```

- [ ] **Step 6: Run API tests to verify they fail**

Run: `pnpm vitest run server/api.assessments.test.ts`

Expected: FAIL because the API server and route do not exist.

- [ ] **Step 7: Implement HTTP parsing and `POST /api/assessments`**

Implement a maximum 1 MB JSON request reader, JSON response helper, stable error JSON `{ error: { code, message } }`, request ID generation and `Cache-Control: no-store`. On valid submission: normalize/encrypt/hash phone, score server-side, create a `ready` assessment with raw payload and report snapshot, then return only `assessmentId`, `report`, `reportGeneratedAt` and report version. On invalid JSON, oversized body or validation failure, return 400; unexpected errors return 500 with a generic message and an error ID. Do not log request bodies.

Implement `GET /health` and `server/index.ts` startup/shutdown. Permit CORS only for configured `APP_ORIGIN`; send `Access-Control-Allow-Credentials: true` only for that explicit origin.

- [ ] **Step 8: Run submit API tests to verify they pass**

Run: `pnpm vitest run server/api.assessments.test.ts`

Expected: PASS.

- [ ] **Step 9: Run the existing scoring regression suite**

Run: `pnpm vitest run src/lib/assessment.test.ts src/lib/classification-v2.test.ts src/lib/task-distribution-audit.test.ts`

Expected: PASS; failures indicate server extraction changed existing report semantics.

- [ ] **Step 10: Commit server scoring and submission**

```bash
git add server src/lib/transport.ts
git commit -m "feat: submit assessments to authoritative server scoring"
```

## Task 3: 管理员认证、检索、详情与重新生成 API

**Files:**
- Create: `server/api.admin.test.ts`
- Modify: `server/api.ts`
- Modify: `server/database.ts`
- Modify: `server/security.ts`

**Interfaces:**
- Consumes `createApiServer`, `AssessmentDatabase`, `SecurityService`, `scoreSubmission`.
- Produces `POST /api/admin/login`, `POST /api/admin/logout`, `GET /api/admin/assessments`, `GET /api/admin/assessments/:id`, `POST /api/admin/assessments/:id/regenerate`.

- [ ] **Step 1: Write failing administrator API tests**

Create one submitted assessment, then assert:

```ts
const denied = await request(server, 'GET', '/api/admin/assessments')
expect(denied.status).toBe(401)

const login = await request(server, 'POST', '/api/admin/login', { username: 'admin', password: 'correct-password' })
expect(login.status).toBe(204)
expect(login.headers['set-cookie']).toContain('HttpOnly')

const list = await request(server, 'GET', '/api/admin/assessments?name=王&page=1&pageSize=20', undefined, login.cookie)
expect(list.body.items[0]).toMatchObject({ studentName: '王同学', phoneMasked: '138****8000' })
expect(list.body.items[0]).not.toHaveProperty('phone')

const detail = await request(server, 'GET', `/api/admin/assessments/${id}`, undefined, login.cookie)
expect(detail.body.student.phone).toBe('13800138000')
expect((await request(server, 'POST', `/api/admin/assessments/${id}/regenerate`, {}, login.cookie)).body.reportRevision).toBe(2)
```

Also assert bad credentials return 401, an invalid phone search returns 400, unknown IDs return 404, and logout clears the cookie.

- [ ] **Step 2: Run administrator API tests to verify they fail**

Run: `pnpm vitest run server/api.admin.test.ts`

Expected: FAIL because the administrator routes are absent.

- [ ] **Step 3: Implement authentication and routes**

Use the security service password verifier; never reveal whether username or password was wrong. Set `Path=/`, `HttpOnly`, `SameSite=Lax`, `Max-Age=28800`, and conditionally `Secure` in the login response. Parse and verify the signed cookie before each admin route. Add page size validation (`1..100`), name trimming, and exact normalized-phone search.

The list response returns `id`, `studentName`, `phoneMasked`, `grade`, `completedAt`, `status`, `reportRevision`; it never includes raw responses or encrypted phone. The detail response decrypts phone only after authentication and returns original submission metadata and the latest report snapshot. Regeneration scores persisted raw responses with the current server scorer, replaces only `report_json`, increments `report_revision`, and retains the original responses and version history metadata.

- [ ] **Step 4: Run administrator API tests to verify they pass**

Run: `pnpm vitest run server/api.admin.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the administrator API**

```bash
git add server
git commit -m "feat: add authenticated assessment administration API"
```

## Task 4: 学生端提交、手机号和失败重试

**Files:**
- Create: `src/lib/api-client.ts`
- Create: `src/lib/api-client.test.ts`
- Modify: `src/data/assessment-types.ts`
- Modify: `src/lib/session.ts`
- Modify: `src/lib/session.test.ts`
- Modify: `src/lib/assessment.ts`
- Modify: `src/components/IntakeScreen.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Produces `submitAssessment(snapshot): Promise<{ assessmentId: string; report: ReportModel; reportGeneratedAt: string; reportRevision: number }>`.
- Extends `Intake` with `phone: string` and `SessionSnapshot` with `submission: { status: 'idle' | 'submitting' | 'failed' | 'saved'; assessmentId?: string; error?: string; report?: ReportModel }`.
- Consumes the authoritative API and no longer calculates the final student report in the browser.

- [ ] **Step 1: Write failing client tests**

Add a session test confirming phone is persisted in the resumable local session and an API client test confirming non-2xx responses become a Chinese retry-safe error. In `App.test.tsx`, fill name, valid phone, grade, language and complete a controlled final snapshot. Assert that success displays the returned report plus `已保存到机构后台`; assert failure displays `尚未提交，可重试` and retains the same task responses.

- [ ] **Step 2: Run client tests to verify they fail**

Run: `pnpm vitest run src/lib/api-client.test.ts src/lib/session.test.ts src/App.test.tsx`

Expected: FAIL because Intake has no phone and the app has no remote submission state.

- [ ] **Step 3: Implement the API client and intake validation**

Add `phone` to `Intake`, `emptyIntake`, snapshot validation and `validateIntake`. The UI must label the field `手机号`, set `inputMode="tel"`, accept only normalizable 11-digit mainland numbers and show `请输入正确的手机号` otherwise. The privacy copy must say it is only used by the institution to find the report and does not affect scoring.

`api-client.ts` posts the final snapshot to `/api/assessments`, uses `credentials: 'include'`, does not place phone in a URL, and maps known server error messages to student-friendly text. It must not write API payloads to console.

- [ ] **Step 4: Refactor final-submit flow**

While answering individual questions, store raw `SavedResponse` records and do not invoke an answer-key transport in production. After the last valid response, transition to processing and call `submitAssessment` once. On success store only the server-returned `assessmentId`, report and metadata in the in-memory/session submission state, then render `Report` with that report. On failure retain raw responses, return to a retryable processing state and render a visible `重新提交` action. Do not transition to a report before server success.

Retain an explicit local-only preview mode for existing component tests and design preview files. The production build must not include answer keys or `LocalPrototypeAdapter`.

- [ ] **Step 5: Run client tests to verify they pass**

Run: `pnpm vitest run src/lib/api-client.test.ts src/lib/session.test.ts src/App.test.tsx`

Expected: PASS.

- [ ] **Step 6: Build the deployment bundle and inspect it**

Run: `pnpm build:deployment && rg -n 'correctAnswer|v16AnswerKey|LocalPrototypeAdapter' dist`

Expected: the build succeeds and `rg` returns no matches. Any hit blocks this task because answer logic remains client-visible.

- [ ] **Step 7: Commit the student submission flow**

```bash
git add src vite.config.ts
git commit -m "feat: submit student assessments and retain retry state"
```

## Task 5: React 管理端、详情与打印报告

**Files:**
- Create: `src/AdminApp.tsx`
- Create: `src/admin/AdminLogin.tsx`
- Create: `src/admin/AssessmentList.tsx`
- Create: `src/admin/AssessmentDetail.tsx`
- Create: `src/admin/admin-types.ts`
- Create: `src/admin/admin-api.ts`
- Create: `src/admin/AdminApp.test.tsx`
- Modify: `src/main.tsx`
- Modify: `src/components/Report.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes the authenticated administrator API.
- Produces route handling for `/admin`, `/admin/assessments/:id`, and `/admin/assessments/:id/print`.
- Reuses `Report({ name, report })` rather than duplicating report markup.

- [ ] **Step 1: Write failing administrator UI tests**

Create `src/admin/AdminApp.test.tsx` with mocked fetch responses. Assert:

```tsx
render(<AdminApp />)
await user.type(screen.getByLabelText('用户名'), 'admin')
await user.type(screen.getByLabelText('密码'), 'correct-password')
await user.click(screen.getByRole('button', { name: '登录' }))
expect(await screen.findByText('测评记录')).toBeInTheDocument()

await user.type(screen.getByLabelText('按姓名或完整手机号搜索'), '王同学')
expect(await screen.findByText('138****8000')).toBeInTheDocument()
await user.click(screen.getByRole('link', { name: '查看报告' }))
expect(await screen.findByText('打印报告')).toBeInTheDocument()
```

Add a print-route assertion that backend navigation controls are absent while `01｜我的核心结论` is present.

- [ ] **Step 2: Run UI tests to verify they fail**

Run: `pnpm vitest run src/admin/AdminApp.test.tsx`

Expected: FAIL because the management application does not exist.

- [ ] **Step 3: Implement the admin API client and route shell**

Create an `admin-api.ts` wrapper that always uses `credentials: 'include'`, converts 401 into an unauthenticated state, and never logs detail payloads. In `main.tsx`, render `AdminApp` only when pathname starts with `/admin`; otherwise render the existing student `App`.

The list uses a table on desktop and a concise stacked row on mobile, showing only name, masked phone, grade, completion time, state and a `查看报告` action. Search input dispatches a request only after explicit submit or Enter; phone remains exact search on the server. Detail displays complete phone only after successful authorized fetch, report version/time, a `重新生成报告` button with an explicit in-place success result, and `打印报告`.

- [ ] **Step 4: Implement report reuse and print mode**

For `/admin/assessments/:id/print`, fetch the same detail data, render `Report` with the student name and report snapshot, and omit `AdminApp` navigation. Update `Report` to accept an optional `printMeta` prop containing report generation/revision information rendered only in the print document footer. Use `@media print` to hide `.admin-shell`, search controls and all buttons, expand task details before print, preserve navy/gold colors with `print-color-adjust: exact`, and avoid breaking task cards across pages.

- [ ] **Step 5: Run UI tests to verify they pass**

Run: `pnpm vitest run src/admin/AdminApp.test.tsx src/components/Report.test.tsx`

Expected: PASS.

- [ ] **Step 6: Run the app and verify core journeys in browser**

Run `pnpm dev` and `pnpm dev:server` with a test `.env` outside git. In the browser, complete a test assessment, inspect the success state, login at `/admin`, search its full phone, open detail and use the print route. Verify no phone appears in the student URL, the admin list only masks it, and the print preview contains report sections 01–04 without administration controls.

- [ ] **Step 7: Commit the management interface**

```bash
git add src
git commit -m "feat: add assessment administration and printable reports"
```

## Task 6: 生产构建、部署文档、备份与全量验证

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `README.md`
- Modify: `.gitignore`
- Create: `scripts/backup-database.mjs`
- Create: `scripts/backup-database.test.ts`
- Modify: `src/lib/score-range-simulation.test.ts`

**Interfaces:**
- Produces `pnpm build:production`, `pnpm start:server`, `pnpm backup:database`.
- Consumes `DATABASE_PATH` and creates a timestamped backup outside the active database path.

- [ ] **Step 1: Write a failing backup test**

Create a temporary SQLite file with one assessment. Invoke the backup helper with a temporary backup directory and assert one file named `meta-ability-YYYYMMDD-HHmmss.sqlite` exists, opens successfully and contains the source assessment count. Assert the helper rejects an empty source path and refuses a destination equal to the active database path.

- [ ] **Step 2: Run backup test to verify it fails**

Run: `pnpm vitest run scripts/backup-database.test.ts`

Expected: FAIL because the backup helper is absent.

- [ ] **Step 3: Implement production scripts and backup**

Implement `backup-database.mjs` with `fs.copyFile`, a timestamped filename and non-zero exit on invalid configuration. Add `backup:database` and `build:production` scripts; the latter runs the deployment frontend build and SSR server build. Update Vite configuration so `/api` proxies to local Node server only in development and the production frontend retains relative asset paths.

Add `data/`, `backups/`, `.env`, `.env.*` except `.env.example`, `dist-server/` and local test database patterns to `.gitignore`.

- [ ] **Step 4: Update deployment and operating documentation**

In `README.md`, replace the current “no backend” statement with exact commands for: generating administrator credentials, copying `.env.example`, local student/admin startup, building production artifacts, starting the Node process, Nginx/HTTPS reverse-proxy requirements, SQLite daily backup command, database restoration prerequisite, and OSS boundary. State that OSS may host public frontend files but never `.env`, database files or backups.

- [ ] **Step 5: Run focused and full automated checks**

Run:

```bash
pnpm test:server
pnpm test
pnpm build:production
pnpm build:deployment
pnpm vitest run src/lib/score-range-simulation.test.ts
```

Expected: all commands exit 0. The score-band simulation must retain valid server-generated classifications across its existing 300–500 score cases.

- [ ] **Step 6: Perform deployable artifact audit**

Run:

```bash
rg -n 'ADMIN_PASSWORD|SESSION_SECRET|PHONE_ENCRYPTION_KEY|phone_encrypted|correctAnswer|v16AnswerKey' dist dist-server || true
git status --short
```

Expected: no secret values, encrypted database values or client answer keys in `dist`; source variable names in server bundle are acceptable only if they do not include configured values. No database, backup or `.env` file may appear in `git status`.

- [ ] **Step 7: Commit production readiness work**

```bash
git add package.json pnpm-lock.yaml vite.config.ts README.md .gitignore scripts .env.example
git commit -m "docs: document secure assessment service deployment"
```

## Plan self-review

- **Spec coverage:** Task 1 covers secure configuration, encryption, session and persistent storage. Task 2 makes scoring authoritative and persists immutable submissions. Task 3 covers internal administrator authentication, query, detail and explicit regeneration. Task 4 implements phone collection, submission success/failure and no false-saved state. Task 5 implements the requested backend webpage and reusable printable report. Task 6 covers backups, OSS/server deployment boundary, full test and artifact audits.
- **Placeholder scan:** no deferred implementation markers or undefined generic error-handling steps remain; every task names exact files, interfaces, tests and commands.
- **Type consistency:** `AssessmentDatabase`, `SecurityService`, `scoreSubmission`, `submitAssessment`, report snapshot, `assessmentId` and `reportRevision` are consistently named across task boundaries.
