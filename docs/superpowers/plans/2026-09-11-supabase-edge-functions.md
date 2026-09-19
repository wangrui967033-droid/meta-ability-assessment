# Supabase Edge Functions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the production Node API with a Supabase Edge Function while preserving the assessment and admin API contracts.

**Architecture:** A single `assessment-api` Deno Edge Function performs request validation, assessment scoring, phone protection, project-scoped Supabase operations, and admin session management. OSS-hosted React apps call its configurable function URL; all secrets remain in Supabase Edge Function Secrets.

**Tech Stack:** Supabase Edge Functions (Deno/TypeScript), `@supabase/supabase-js`, Web Crypto, React/Vite, Vitest, Supabase Postgres.

**Spec:** `docs/superpowers/specs/2026-09-11-supabase-edge-functions-design.md`

## Global Constraints

- Preserve existing student and admin UI, report algorithm, and visible API response shapes.
- Keep all sensitive values out of Vite builds, OSS artifacts, Git, and browser storage.
- Use `ASSESSMENT_PROJECT_KEY` on every database operation; do not allow cross-project record access.
- Keep `assessments` and `app_projects` schema/RPC behavior unchanged except for the specified login-limit migration.
- Require exact allowed origins, 1 MiB JSON request maximum, `Cache-Control: no-store`, and `Vary: Origin`.
- Edge Function must not log phone numbers, answers, reports, secrets, or encrypted phone payloads.

---

### Task 1: Make scoring and payload contracts runtime-neutral

**Files:**
- Create: `shared/assessment-api-types.ts`
- Create: `shared/score-assessment.ts`
- Create: `shared/score-assessment.test.ts`
- Modify: `server/score-assessment.ts`
- Modify: `server/api.ts`
- Modify: `server/score-assessment.test.ts`

**Interfaces:**
- Consumes: existing V1.6 bank, `buildPrototypeReport`, intake and subject types.
- Produces: `scoreSubmission(payload: unknown): ScoredSubmission`, `SubmissionValidationError`, `ASSESSMENT_VERSIONS`, and `AssessmentSubmissionPayload` with no `node:*` imports.

- [ ] **Step 1: Write a failing cross-runtime scoring test**

```ts
import { ASSESSMENT_VERSIONS, scoreSubmission } from './score-assessment'

it('scores a valid complete V1.6 payload without Node runtime helpers', () => {
  const result = scoreSubmission(validSubmissionPayload())
  expect(result.report.dimensionSummary).toHaveLength(5)
  expect(result.intake.phone).toBe('13800138000')
  expect(ASSESSMENT_VERSIONS.bank).toMatch(/^1\.6-/)
})
```

- [ ] **Step 2: Run the focused test to confirm it fails before extraction**

Run: `pnpm exec vitest run shared/score-assessment.test.ts`

Expected: FAIL because `shared/score-assessment.ts` does not exist.

- [ ] **Step 3: Extract pure scoring into a shared module**

```ts
export class SubmissionValidationError extends Error {}

export function normalizeAssessmentPhone(phone: string): string {
  const normalized = phone.replace(/\s/g, '')
  if (!/^1[3-9]\d{9}$/.test(normalized)) throw new Error('手机号格式不正确')
  return normalized
}

export function scoreSubmission(payload: unknown): ScoredSubmission {
  // Move the existing intake, version, and response validation unchanged.
}
```

Import `normalizeAssessmentPhone` from the shared module instead of `server/security.ts`; leave `server/score-assessment.ts` as a backwards-compatible re-export during this migration.

- [ ] **Step 4: Run focused shared and server scoring tests**

Run: `pnpm exec vitest run shared/score-assessment.test.ts server/score-assessment.test.ts`

Expected: PASS; valid submissions score identically and invalid phones still return the same validation text.

- [ ] **Step 5: Commit the independently testable extraction**

```bash
git add shared/assessment-api-types.ts shared/score-assessment.ts shared/score-assessment.test.ts server/score-assessment.ts server/api.ts server/score-assessment.test.ts
git commit -m "refactor: share assessment scoring across runtimes"
```

### Task 2: Add the server-only login-limit data structure

**Files:**
- Create: `supabase/migrations/20260911000001_admin_login_attempts.sql`
- Modify: `supabase/migrations/20260911000000_assessments.sql` only if function permissions must be corrected for a fresh installation
- Test: `supabase/tests/admin-login-attempts.sql`

**Interfaces:**
- Consumes: `public.app_projects(id, project_key)`.
- Produces: `public.admin_login_attempts(project_id, client_key_hash, failures, expires_at, updated_at)` with `unique(project_id, client_key_hash)`; no `anon` or `authenticated` privileges.

- [ ] **Step 1: Write migration assertions before implementing the table**

```sql
select has_table('public', 'admin_login_attempts');
select rowsecurity
from pg_tables
where schemaname = 'public' and tablename = 'admin_login_attempts';
```

Expected before migration: table assertion fails or returns false.

- [ ] **Step 2: Create the migration with bounded server-only columns**

```sql
create table public.admin_login_attempts (
  project_id uuid not null references public.app_projects(id) on delete cascade,
  client_key_hash text not null check (client_key_hash ~ '^[A-Za-z0-9_-]{20,128}$'),
  failures integer not null check (failures >= 1 and failures <= 100),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (project_id, client_key_hash)
);
create index admin_login_attempts_expiry_idx on public.admin_login_attempts (expires_at);
alter table public.admin_login_attempts enable row level security;
revoke all on public.admin_login_attempts from anon, authenticated;
```

- [ ] **Step 3: Apply migration to a local Supabase instance and run assertions**

Run: `supabase db reset && supabase test db`

Expected: table exists, RLS is enabled, and browser roles have no table privileges.

- [ ] **Step 4: Commit the schema migration and assertion**

```bash
git add supabase/migrations/20260911000001_admin_login_attempts.sql supabase/tests/admin-login-attempts.sql
git commit -m "feat: persist Edge Function login limits"
```

### Task 3: Build Edge Function primitives for configuration, security, and database access

**Files:**
- Create: `supabase/functions/assessment-api/config.ts`
- Create: `supabase/functions/assessment-api/security.ts`
- Create: `supabase/functions/assessment-api/database.ts`
- Create: `supabase/functions/assessment-api/security.test.ts`
- Create: `supabase/functions/assessment-api/database.test.ts`

**Interfaces:**
- Consumes: Deno `Deno.env.get`, Web Crypto `crypto.subtle`, `@supabase/supabase-js`, shared scoring types.
- Produces: `loadEdgeConfig(env)`, `createEdgeSecurity(config)`, `openEdgeDatabase(config)`, `AssessmentDatabase`-compatible database operations, and persistent `LoginRateLimiter` methods.

- [ ] **Step 1: Write failing security tests for phone round trips and signed sessions**

```ts
it('encrypts phones and rejects a tampered signed session', async () => {
  const security = await createEdgeSecurity(testConfig)
  const encrypted = await security.encryptPhone('13800138000')
  await expect(security.decryptPhone(encrypted)).resolves.toBe('13800138000')
  await expect(security.verifySession(`${security.createSession('admin', now)}x`, now)).resolves.toBeNull()
})
```

- [ ] **Step 2: Run the security test to confirm it fails**

Run: `deno test --allow-env --allow-crypto supabase/functions/assessment-api/security.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement strict config and Web Crypto security functions**

```ts
export interface EdgeConfig {
  supabaseUrl: string
  serviceRoleKey: string
  assessmentProjectKey: string
  appOrigin: string
  adminUsername: string
  adminPasswordHash: string
  sessionSecret: string
  phoneEncryptionKey: string
  phoneLookupSecret: string
}

export async function createEdgeSecurity(config: EdgeConfig) {
  // AES-GCM with 12-byte IV; HMAC-SHA-256 sessions; HMAC phone lookup hashes.
}
```

Reject malformed URLs, project keys, phone numbers, malformed encrypted payloads, invalid password records, and expired sessions. Use only `crypto.subtle`, `TextEncoder`, `atob`, and `btoa`; do not import `node:crypto`.

- [ ] **Step 4: Write failing database-adapter tests with a mocked Supabase client**

```ts
it('filters every list and detail query by project_id', async () => {
  const database = openEdgeDatabase(testConfig, fakeClient)
  await database.findAssessments({ page: 1, pageSize: 20 })
  expect(fakeClient.calls).toContainEqual(expect.objectContaining({ table: 'assessments', filter: ['project_id', projectId] }))
})
```

- [ ] **Step 5: Implement project lookup, list/detail, RPC insert, snapshot replace, and login-limit persistence**

```ts
export function openEdgeDatabase(config: EdgeConfig, client = createClient(config.supabaseUrl, config.serviceRoleKey)) {
  async function projectId(): Promise<string> { /* resolve app_projects by project_key once */ }
  return { createOrFindAssessment, findAssessments, findAssessmentById, replaceReportSnapshotAtomically, loginLimiter }
}
```

Use `p_project_key` for both existing RPCs. All direct `assessments` selects must include the resolved `project_id`; unknown project keys are a server configuration failure.

- [ ] **Step 6: Run Deno unit tests**

Run: `deno test --allow-env --allow-crypto supabase/functions/assessment-api/security.test.ts supabase/functions/assessment-api/database.test.ts`

Expected: PASS; encryption, session validation, project scoping, and login-limiter state transitions are covered.

- [ ] **Step 7: Commit Edge Function primitives**

```bash
git add supabase/functions/assessment-api/config.ts supabase/functions/assessment-api/security.ts supabase/functions/assessment-api/database.ts supabase/functions/assessment-api/security.test.ts supabase/functions/assessment-api/database.test.ts
git commit -m "feat: add secure Edge Function primitives"
```

### Task 4: Implement the `assessment-api` Edge Function routes

**Files:**
- Create: `supabase/functions/assessment-api/index.ts`
- Create: `supabase/functions/assessment-api/index.test.ts`
- Modify: `shared/score-assessment.ts` only if exported validation metadata is needed

**Interfaces:**
- Consumes: `scoreSubmission`, `ASSESSMENT_VERSIONS`, `createEdgeSecurity`, `openEdgeDatabase`.
- Produces: `handleAssessmentApi(request, dependencies): Promise<Response>` and Deno `serve` entrypoint.

- [ ] **Step 1: Write failing endpoint tests using a fake database and clock**

```ts
it('creates a report through POST /assessments and is idempotent', async () => {
  const response = await handleAssessmentApi(post('/assessments', validSubmissionPayload()), dependencies)
  expect(response.status).toBe(201)
  expect(await response.json()).toEqual(expect.objectContaining({ assessmentId: expect.any(String), reportRevision: 1 }))
})

it('rejects an admin list request without a valid session', async () => {
  expect((await handleAssessmentApi(get('/admin/assessments'), dependencies)).status).toBe(401)
})
```

- [ ] **Step 2: Run route tests to confirm they fail**

Run: `deno test --allow-env --allow-crypto supabase/functions/assessment-api/index.test.ts`

Expected: FAIL because `handleAssessmentApi` does not exist.

- [ ] **Step 3: Implement shared HTTP protections and student submission route**

```ts
const MAX_JSON_BYTES = 1024 * 1024
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }

function corsHeaders(request: Request, origin: string): Headers { /* exact Origin only */ }
async function readJson(request: Request): Promise<unknown> { /* body limit and JSON error */ }
```

For `/assessments`, maintain existing validation, stable payload hashing, phone masking, response metadata allow-listing, idempotency behavior (`201`, `200`, `409`), and saved-report response format.

- [ ] **Step 4: Implement administrator routes and persistent rate limiting**

```ts
// POST /admin/login: origin + JSON checks, verify credentials, read/update login limiter, then Set-Cookie.
// POST /admin/logout: require session and JSON {}, then expire cookie.
// GET /admin/assessments: session, bounded page/pageSize/name parsing.
// POST /admin/assessments/search: session, origin, exact phone lookup.
// GET detail + POST regenerate: session, project-scoped lookup, snapshot RPC.
```

Use the existing public error codes/messages and prevent request identifiers or internal causes from being exposed in expected validation paths.

- [ ] **Step 5: Extend route tests to all critical branches**

```ts
it.each(['wrong-origin', 'too-large-json', 'bad-content-type'])('rejects %s management writes', async (caseName) => { /* expect 403 or 415/413 */ })
it('returns 429 after configured failed login attempts and clears failures after successful login', async () => { /* assert Retry-After */ })
it('cannot load or regenerate an assessment belonging to another project', async () => { /* expect 404 */ })
```

- [ ] **Step 6: Run complete Edge Function tests**

Run: `deno test --allow-env --allow-crypto supabase/functions/assessment-api`

Expected: PASS; all routes preserve behavior and sensitive values do not appear in errors.

- [ ] **Step 7: Commit the API function**

```bash
git add supabase/functions/assessment-api/index.ts supabase/functions/assessment-api/index.test.ts shared/score-assessment.ts
git commit -m "feat: move assessment API to Supabase Edge Function"
```

### Task 5: Point static frontends to the Edge Function without exposing secrets

**Files:**
- Modify: `src/lib/api-client.ts`
- Modify: `src/admin/admin-api.ts`
- Modify: `src/lib/api-client.test.ts`
- Modify: `src/admin/AdminApp.test.tsx`
- Modify: `vite.config.ts`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Consumes: `import.meta.env.VITE_ASSESSMENT_API_URL`.
- Produces: `assessmentApiUrl(path: string): string` used by student and admin clients; no secret-bearing Vite variables.

- [ ] **Step 1: Write failing client URL-resolution tests**

```ts
it('uses the configured Edge Function root when provided', () => {
  expect(assessmentApiUrl('/assessments', 'https://project.supabase.co/functions/v1/assessment-api'))
    .toBe('https://project.supabase.co/functions/v1/assessment-api/assessments')
})

it('keeps the development Node fallback when no public root is configured', () => {
  expect(assessmentApiUrl('/assessments', '')).toBe('/api/assessments')
})
```

- [ ] **Step 2: Run client test to confirm it fails**

Run: `pnpm exec vitest run src/lib/api-client.test.ts`

Expected: FAIL because `assessmentApiUrl` is not exported.

- [ ] **Step 3: Implement one public API URL resolver and update both clients**

```ts
export function assessmentApiUrl(path: string, root = import.meta.env.VITE_ASSESSMENT_API_URL ?? ''): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return root.trim() ? `${root.replace(/\/$/, '')}${normalizedPath}` : `/api${normalizedPath}`
}
```

Replace hardcoded `/api/...` calls in student and admin clients. Preserve `credentials: 'include'`; Edge Function CORS accepts the exact OSS Origin.

- [ ] **Step 4: Restrict build-time settings and document environment split**

```dotenv
# Public, safe to embed in an OSS build.
VITE_ASSESSMENT_API_URL=https://xldjstqwqydcohsebnde.supabase.co/functions/v1/assessment-api

# Server-only values are Supabase Edge Function Secrets. Never define them with VITE_.
```

Document local Node development fallback, Edge Function local serving, production build command, and the explicit rule that `SUPABASE_SERVICE_ROLE_KEY` never appears in `.env` used by Vite.

- [ ] **Step 5: Run frontend API and production artifact tests**

Run: `pnpm exec vitest run src/lib/api-client.test.ts src/admin/AdminApp.test.tsx && pnpm run build:deployment && pnpm run audit:student-bundle`

Expected: PASS; URL selection is correct and student artifact scanner finds no secrets or answer key.

- [ ] **Step 6: Commit static client integration**

```bash
git add src/lib/api-client.ts src/admin/admin-api.ts src/lib/api-client.test.ts src/admin/AdminApp.test.tsx vite.config.ts .env.example README.md
git commit -m "feat: route static clients to Edge Function"
```

### Task 6: Deploy, configure, and verify the live Supabase backend

**Files:**
- Modify: `README.md`
- Modify: `scripts/production-artifact-audit.mjs`
- Create: `scripts/edge-function-smoke-test.mjs`
- Test: `scripts/edge-function-smoke-test.test.ts`

**Interfaces:**
- Consumes: deployed `assessment-api` function and Supabase Secrets.
- Produces: reproducible deployment instructions and an authenticated-safe smoke test which never logs sensitive data.

- [ ] **Step 1: Write a failing smoke-test fixture for health and CORS responses**

```ts
it('requires an explicit function base URL and exact expected origin', async () => {
  await expect(runSmokeTest({ functionUrl: '', origin: '' })).rejects.toThrow('缺少')
})
```

- [ ] **Step 2: Implement the smoke test with non-sensitive checks only**

```ts
const health = await fetch(`${functionUrl}/health`, { headers: { Origin: origin } })
if (!health.ok) throw new Error(`健康检查失败：${health.status}`)
if (health.headers.get('access-control-allow-origin') !== origin) throw new Error('CORS 配置不匹配')
```

- [ ] **Step 3: Apply migration and set Edge Function secrets in the Supabase dashboard or CLI**

Run:

```bash
supabase db push
supabase secrets set ASSESSMENT_PROJECT_KEY=meta-ability-assessment APP_ORIGIN=https://sishu.ray.xshq0521.cn ADMIN_USERNAME=... ADMIN_PASSWORD_HASH=... SESSION_SECRET=... PHONE_ENCRYPTION_KEY=... PHONE_LOOKUP_SECRET=...
supabase functions deploy assessment-api --no-verify-jwt
```

Expected: migration and function deployment succeed. Do not paste secret values in command history, README, shell output, or Git.

- [ ] **Step 4: Build and upload OSS static artifacts with the public function URL**

Run:

```bash
VITE_ASSESSMENT_API_URL=https://xldjstqwqydcohsebnde.supabase.co/functions/v1/assessment-api pnpm run build:deployment
pnpm run audit:student-bundle
```

Upload the generated `dist/` contents beneath the existing project-specific OSS directory only; retain separate subdirectories for future projects.

- [ ] **Step 5: Execute live smoke tests and one full assessment lifecycle**

Run: `EDGE_FUNCTION_URL=https://xldjstqwqydcohsebnde.supabase.co/functions/v1/assessment-api APP_ORIGIN=https://sishu.ray.xshq0521.cn node scripts/edge-function-smoke-test.mjs`

Expected: `/health` returns `200`, exact CORS header is present, public response never exposes secrets, student submits once, management login can find the record, report opens, print view renders, and re-generation increments only that report's revision.

- [ ] **Step 6: Run final automated verification**

Run: `pnpm test && pnpm run test:server && pnpm run build:production && git diff --check`

Expected: all tests/build checks pass and no whitespace errors exist.

- [ ] **Step 7: Commit deployment tooling and documentation**

```bash
git add README.md scripts/production-artifact-audit.mjs scripts/edge-function-smoke-test.mjs scripts/edge-function-smoke-test.test.ts
git commit -m "docs: document Edge Function deployment"
```
