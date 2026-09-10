# 元能力测评学生端 V1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有25题单选原型升级为符合30题专家预校准母版的、可在手机独立完成并生成五段式报告的学生端 React 应用。

**Architecture:** 采用数据驱动的固定30题运行器：页面组件只渲染任务交互和收集作答，不读取正确答案；`AssessmentTransport` 将原型本地评分和未来服务端评分分离。顶层流程负责信息采集、Deck A/B、断点恢复、题目序列和报告，任务交互拆成小组件，报告只消费版本化的证据聚合结果。

**Tech Stack:** React 18、TypeScript、Vite、Vitest、Testing Library、lucide-react、内联 SVG、CSS。

**Spec:** `docs/superpowers/specs/2026-09-01-元能力测评-frontend-v1-design.md`

## Global Constraints

- 固定30个节点；五项一级能力各6节点、十五机制各2节点、17 direct + 8 cross-representation + 5 cross-context。
- 姓名、手机号、年级、外语语种均必填；不采集选科组合。
- 学生端不得显示题号、固定题量、即时对错、排名、百分位、能力等级、单/双入口类型或强倒计时。
- Deck A在位置01前呈现，Deck B在位置18前呈现；已提交任务不可回看或重答。
- 位置06必须是集合式反对齐的三次点灯映射；位置08必须是无拖拽/预览的两图块脑中拼合 SVG。
- 视觉沿用 `design/assessment-concept.png`、`design/report-concept.png`、`design/qa-intro-mobile.png`、`design/qa-question-mobile.png` 的深海军蓝、克制金色、纸白背景、中文衬线标题和开放留白。
- 本地 `prototype` 答案键只用于演示和测试；生产适配器只提交不透明答案与事件。
- 任务从失败测试开始实现；仓库没有 Git 元数据，跳过提交步骤，但每个任务必须运行目标测试和全量测试。

---

### Task 1: 建立30题领域模型、数据校验与版本化会话

**Files:**
- Create: `src/data/assessment-types.ts`
- Create: `src/data/assessment-bank.ts`
- Create: `src/lib/session.ts`
- Create: `src/lib/session.test.ts`
- Modify: `src/data/questions.ts`
- Modify: `src/data/questions.test.ts`
- Modify: `src/lib/assessment.ts`
- Modify: `src/lib/assessment.test.ts`

**Interfaces:**
- Produces `AssessmentTask`, `TaskResponse`, `Intake`, `SessionSnapshot`, `assessmentTasks`, `deckA`, `deckB`, `validateAssessmentBank()`, `validateIntake()` and `createSessionSnapshot()`.
- `AssessmentTask` includes `id`, `version`, `position`, `dimension`, `mechanism`, `role`, `prompt`, `helper?`, `interaction`, `expectedSeconds`; it must not include a production answer key.
- `SessionSnapshot` stores `schemaVersion`, `intake`, `screen`, `currentPosition`, `deckASeen`, `deckBSeen`, `responses`, `updatedAt`.

- [ ] **Step 1: Write failing domain-bank tests**

```ts
it('locks the 30-node blueprint distribution and the revised positions 06 and 08', () => {
  expect(assessmentTasks).toHaveLength(30)
  expect(assessmentTasks.filter((task) => task.role === 'direct')).toHaveLength(17)
  expect(assessmentTasks.find((task) => task.position === 6)?.id).toBe('IN-RL-01R2')
  expect(assessmentTasks.find((task) => task.position === 8)?.id).toBe('SP-IM-08-NEW-01')
})

it('keeps both decks at six mutually isolated items', () => {
  expect(deckA).toHaveLength(6)
  expect(deckB).toHaveLength(6)
  expect(new Set([...deckA, ...deckB].map((item) => item.id)).size).toBe(12)
})
```

- [ ] **Step 2: Run the domain-bank test and verify it fails because `assessment-bank` does not exist**

Run: `npm test -- src/data/questions.test.ts`

Expected: FAIL with a missing module or missing `assessmentTasks` export.

- [ ] **Step 3: Write failing intake/session tests**

```ts
it('requires name, mobile, grade and language before it creates a session', () => {
  expect(validateIntake({ name: '林晓', phone: '13800000000', grade: '', foreignLanguage: '英语' }))
    .toEqual({ grade: '请选择年级' })
})

it('restores only snapshots with the current schema version', () => {
  expect(parseSessionSnapshot('{"schemaVersion":0}')).toBeNull()
})
```

- [ ] **Step 4: Run the session test and verify it fails because session helpers do not exist**

Run: `npm test -- src/lib/session.test.ts`

Expected: FAIL with missing `parseSessionSnapshot` or missing intake fields.

- [ ] **Step 5: Implement minimal types, fixed bank and storage helpers**

```ts
export type TaskRole = 'direct' | 'cross-representation' | 'cross-context'

export interface AssessmentTask {
  id: string
  version: string
  position: number
  dimension: Dimension
  mechanism: string
  role: TaskRole
  prompt: string
  helper?: string
  interaction: InteractionDefinition
  expectedSeconds: number
}

export const SESSION_SCHEMA_VERSION = 2

export function parseSessionSnapshot(raw: string | null): SessionSnapshot | null {
  if (!raw) return null
  const parsed: unknown = JSON.parse(raw)
  return isCurrentSessionSnapshot(parsed) ? parsed : null
}
```

Populate all30 positions from `docs/production/08-专家预校准30题版.md`; use generic interaction definitions for standard choices, mapping, slots, sequences and composition. Keep correct answers in a separate internal prototype module created in Task 3.

- [ ] **Step 6: Run focused tests and then the full suite**

Run: `npm test -- src/data/questions.test.ts src/lib/session.test.ts && npm test`

Expected: PASS, with assertions for 30 nodes, 5×6 coverage, 15×2 mechanism coverage, 17/8/5 role distribution, two 6-item decks, and four mandatory intake fields.

---

### Task 2: 实现任务运行器与六类可访问交互

**Files:**
- Create: `src/components/TaskFrame.tsx`
- Create: `src/components/TaskRenderer.tsx`
- Create: `src/components/tasks/SingleChoiceTask.tsx`
- Create: `src/components/tasks/MappingTask.tsx`
- Create: `src/components/tasks/SlotTask.tsx`
- Create: `src/components/tasks/SequenceTask.tsx`
- Create: `src/components/tasks/CompositionTask.tsx`
- Create: `src/components/tasks/TaskRenderer.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- `TaskRenderer({ task, draft, onChange })` renders a controlled interaction and returns no score.
- `TaskFrame({ prompt, helper, progress, children, disabled, onConfirm })` owns consistent header, percentage-only progress, confirmation and no-feedback disclosure.
- `TaskResponse` is a discriminated union: `{ kind: 'choice'; selectedId: string }`, `{ kind: 'mapping'; mapping: Record<string,string> }`, `{ kind: 'slots'; slots: Record<string,string> }`, `{ kind: 'sequence'; ids: string[] }`, `{ kind: 'composition'; answerToken: string }`.

- [ ] **Step 1: Write failing renderer tests for supported behavior**

```tsx
it('does not enable confirmation until a required choice is selected', async () => {
  render(<TaskFrame prompt="测试" progress={34} disabled onConfirm={vi.fn()}><SingleChoiceTask {...choiceProps} /></TaskFrame>)
  expect(screen.getByRole('button', { name: '确认并继续' })).toBeDisabled()
})

it('renders position 06 as three independent radio groups without duplicate blocking', async () => {
  render(<TaskRenderer task={taskAt(6)} draft={null} onChange={onChange} />)
  expect(screen.getByRole('radiogroup', { name: '甲控制的灯' })).toBeInTheDocument()
  expect(screen.getAllByRole('radio', { name: '圆灯' })).toHaveLength(3)
})

it('renders position 08 without drag controls or a composition preview', () => {
  render(<TaskRenderer task={taskAt(8)} draft={null} onChange={onChange} />)
  expect(screen.queryByLabelText('拖动图块')).not.toBeInTheDocument()
  expect(screen.queryByText('预览拼合结果')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run renderer tests and verify they fail because task components are absent**

Run: `npm test -- src/components/tasks/TaskRenderer.test.tsx`

Expected: FAIL with missing component exports.

- [ ] **Step 3: Implement controlled task components**

```tsx
export function MappingTask({ task, value, onChange }: MappingTaskProps) {
  const mapping = value?.kind === 'mapping' ? value.mapping : {}
  return <fieldset aria-label="按钮与灯的对应">{task.buttons.map((button) => (
    <div key={button.id} role="radiogroup" aria-label={`${button.label}控制的灯`}>
      {task.lights.map((light) => <input key={light.id} type="radio" checked={mapping[button.id] === light.id} />)}
    </div>
  ))}</fieldset>
}
```

For position06 show vertically stacked, non-aligned record sets; for position08 render the single source SVG and four outline options with identical viewBox `-6 -6 132 112`. Never render an answer preview, drag target, rotation control or source/answer overlay.

- [ ] **Step 4: Run focused renderer tests and verify they pass**

Run: `npm test -- src/components/tasks/TaskRenderer.test.tsx`

Expected: PASS; keyboard-accessible radios, slots and sequence buttons remain usable.

- [ ] **Step 5: Refactor shared styling into named task families**

Add `.task-frame`, `.progress-rail`, `.record-set`, `.mapping-row`, `.source-composition`, `.composition-option`, `.slot-board` and `.sequence-row` CSS rules. Keep 44px minimum target size, selected state beyond color, and `prefers-reduced-motion` support.

- [ ] **Step 6: Run the full suite**

Run: `npm test`

Expected: PASS without old 25-question assumptions.

---

### Task 3: 实现原型传输层、局部证据聚合和报告数据

**Files:**
- Create: `src/lib/transport.ts`
- Create: `src/lib/prototype-answer-key.ts`
- Create: `src/lib/transport.test.ts`
- Modify: `src/lib/assessment.ts`
- Modify: `src/lib/assessment.test.ts`

**Interfaces:**
- `interface AssessmentTransport { submit(input: SubmittedResponse): Promise<ScoredEvidence> }`
- `LocalPrototypeAdapter` implements the interface only for local Vite/demo use.
- `buildPrototypeReport(evidence, foreignLanguage)` returns `ReportModel` containing `dimensionSummary`, `mechanismSummary`, `subjects`, `learningAdvice`, `conclusion` and no rankings/percentiles/ability grade.

- [ ] **Step 1: Write failing transport/report tests**

```ts
it('scores position 06 only as one node even though it retains three diagnostic points', async () => {
  const score = await localAdapter.submit(position06CorrectResponse)
  expect(score.nodeScore).toEqual({ earned: 1, possible: 1 })
  expect(score.diagnosticPoints).toEqual([1, 1, 1])
})

it('shows Japanese instead of English for a Japanese student while retaining ten subjects', () => {
  const report = buildPrototypeReport(evidenceFixture, '日语')
  expect(report.subjects.map((subject) => subject.subject)).toContain('日语')
  expect(report.subjects.map((subject) => subject.subject)).not.toContain('英语')
  expect(report.subjects).toHaveLength(10)
})
```

- [ ] **Step 2: Run transport/report tests and verify they fail**

Run: `npm test -- src/lib/transport.test.ts src/lib/assessment.test.ts`

Expected: FAIL with missing transport or report-model exports.

- [ ] **Step 3: Implement prototype scoring boundary and cautious report model**

```ts
export class LocalPrototypeAdapter implements AssessmentTransport {
  async submit(input: SubmittedResponse): Promise<ScoredEvidence> {
    return scorePrototypeResponse(input)
  }
}

export function buildPrototypeReport(evidence: ScoredEvidence[], language: ForeignLanguage): ReportModel {
  return {
    conclusion: buildCautiousConclusion(evidence),
    dimensionSummary: summarizeDimensions(evidence),
    mechanismSummary: summarizeMechanisms(evidence),
    subjects: buildSubjectMapFromEvidence(evidence, language),
    learningAdvice: buildLearningAdviceFromEvidence(evidence),
  }
}
```

Use task evidence, not raw correct-rate labels, and word conclusions as “在这次任务中…更容易发挥”。 Keep cross-representation tasks as auxiliary evidence. `prototype-answer-key.ts` must be isolated and documented as non-production.

- [ ] **Step 4: Run focused and full tests**

Run: `npm test -- src/lib/transport.test.ts src/lib/assessment.test.ts && npm test`

Expected: PASS; no `clear`, `paired`, `observe`, percentile, ranking, or fixed threshold output remains in the public `ReportModel`.

---

### Task 4: 重构完整学生流程、恢复机制与五段式报告

**Files:**
- Create: `src/components/IntakeScreen.tsx`
- Create: `src/components/InstructionsScreen.tsx`
- Create: `src/components/MemoryDeck.tsx`
- Create: `src/components/ResumePrompt.tsx`
- Create: `src/components/ProcessingView.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/components/Report.tsx`
- Modify: `src/components/Report.test.tsx`
- Modify: `src/components/RadarChart.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- App states: `'intake' | 'instructions' | 'memory-a' | 'tasks' | 'memory-b' | 'processing' | 'report'`.
- `MemoryDeck({ deck, onComplete })` exposes a deck for an accessible effective duration and never permits return after complete.
- `Report({ name, report })` renders exactly five sections and uses the student's foreign-language selection.

- [ ] **Step 1: Write failing end-to-end flow tests**

```tsx
it('requires all four intake fields and starts with an instruction screen', async () => {
  render(<App />)
  await user.click(screen.getByRole('button', { name: '开始测评' }))
  expect(screen.getByText('请选择年级')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '开始前，先了解一下' })).toBeInTheDocument()
})

it('uses percentage-only progress, inserts Deck B before position 18, and never shows a subject picker', async () => {
  await completeThroughPosition17()
  expect(screen.getByRole('heading', { name: '再记住这六组新信息' })).toBeInTheDocument()
  expect(screen.queryByText(/\/ 30/)).not.toBeInTheDocument()
  expect(screen.queryByText('选择你的3门选考科目')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run App tests and verify they fail against the old flow**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL because the old app has only name/phone, no instruction screen, one five-item deck and an elective picker.

- [ ] **Step 3: Implement the state machine and persistence**

```tsx
const [session, setSession] = useState<SessionSnapshot>(() => loadSession() ?? createFreshSession())
const currentTask = assessmentTasks.find((task) => task.position === session.currentPosition)

function submitCurrent(response: TaskResponse) {
  void transport.submit(buildSubmission(currentTask, response)).then((evidence) => {
    setSession((previous) => advanceSession(previous, evidence))
  })
}
```

Persist after intake, deck exposure completion, each submitted task and report readiness. Use functional state updates. Insert `memory-b` when the next position equals18. Do not expose task numbers; calculate percent as `Math.round(completed / 30 * 100)` internally and render `已完成 43%`.

- [ ] **Step 4: Replace the old report with the approved five sections**

Render one conclusion before: `01｜我的元能力画像`, `02｜为什么这样判断`, `03｜我的学习优势`, `04｜我的学科优势地图`, `05｜我的优势学法`. Section02 must list all five dimensions in model order and their three mechanisms; Section04 lists 10 subjects then each subject's knowledge-graph task examples; Section05 gives 学/背/练/补 actions and no7-day plan.

- [ ] **Step 5: Run focused App and Report tests**

Run: `npm test -- src/App.test.tsx src/components/Report.test.tsx`

Expected: PASS for required fields, Deck ordering, local recovery prompt, no subject picker, no fixed item total, foreign-language-specific 10-subject map and the five report sections.

- [ ] **Step 6: Run typecheck, all tests and production build**

Run: `npm test && npm run build`

Expected: PASS with no TypeScript error.

---

### Task 5: 视觉基准、浏览器流程与移动端验收

**Files:**
- Create: `docs/production/frontend-v1-qa.md`
- Modify: `src/styles.css`
- Modify: `src/App.tsx` only if visual QA discovers a real layout/state defect

**Interfaces:**
- Produces a fidelity ledger comparing screenshots to `design/assessment-concept.png`, `design/report-concept.png`, `design/qa-intro-mobile.png` and `design/qa-question-mobile.png`.

- [ ] **Step 1: Run the app and capture initial route, a task route and the report route**

Run: `npm run dev -- --host 127.0.0.1`

Use Browser/IAB first; if unavailable, use the existing Playwright-capable local browser fallback and record the reason in the QA note.

- [ ] **Step 2: Verify the complete interactive path**

Check name/phone/grade/language validation, instructions, both decks, one choice task, position06 mapping, position08 composition, refresh recovery, processing, report and print button. Confirm no answer feedback, fixed count, elective picker or undeclared report type is visible.

- [ ] **Step 3: Capture and inspect 390×844 and 1440×900 screenshots**

Compare in `view_image` with the four accepted reference images. Inspect: (1) navy/gold/paper palette, (2) headline/body typography, (3) open whitespace and thin rules, (4) primary button and selected option geometry, (5) report hero/radar/section rhythm, (6) mobile target sizes and no overflow.

- [ ] **Step 4: Repair concrete visual drift and re-run comparison**

Only make changes supported by the reference: typography, spacing, color, line, radius, icon treatment or responsive layout. Do not add new pills, dashboards, gamification or generic decorative cards.

- [ ] **Step 5: Record the final fidelity ledger and run release checks**

Run: `npm test && npm run build`

Document all screenshots, tested viewports, repaired mismatches, no-copy-drift result and any intentional limitation: local prototype adapter contains test/demo answer keys and production API remains out of scope.

---

## Self-Review

### Spec coverage

- Intake, instructions, Deck A/B, 30 tasks, recovery and processing are covered by Tasks 1, 2 and 4.
- Revised position06 and position08 construction constraints are covered by Task 2 and their transport semantics by Task 3.
- Formal/production scoring boundary is covered by Task 3.
- The required report conclusion, radar, mechanisms, subjects and learning advice are covered by Tasks 3 and 4.
- Visual baseline, browser flow and responsive QA are covered by Task 5.

### Placeholder scan

No task contains `TODO`, `TBD`, “implement later”, “similar to”, or a test instruction without a concrete expected behavior.

### Type consistency

`AssessmentTask`, `TaskResponse`, `AssessmentTransport`, `ScoredEvidence`, `SessionSnapshot` and `ReportModel` are introduced before their consumers. The same names are used in tasks 1 through 4.
