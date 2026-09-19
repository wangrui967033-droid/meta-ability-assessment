import { orderedV16Tasks } from '../src/data/meta-bank-v1.6.ts'

export const canonicalAnswers = orderedV16Tasks.flatMap((task) =>
  task.items.map((item) => item.correctAnswer),
)

export const canonicalAnswersByTask = orderedV16Tasks.map((task) =>
  task.items.map((item) => item.correctAnswer),
)

export const canonicalExplanations = [...new Set(orderedV16Tasks.flatMap((task) =>
  task.items.flatMap((item) => [
    item.standardDerivation,
    item.uniqueAnswerCheck,
    ...Object.values(item.distractorReasons),
  ]),
).filter((value) => typeof value === 'string' && value.length > 0))]

const forbiddenMarkers = [
  'correctAnswer',
  'standardDerivation',
  'uniqueAnswerCheck',
  'distractorReasons',
  'v16AnswerKey',
  'LocalPrototypeAdapter',
  'src/lib/transport.ts',
  'src/data/meta-bank-v1.6.ts',
]

const answerTupleList = orderedV16Tasks.flatMap((task) =>
  task.items.map((item, index) => [task.id, index, item.correctAnswer]),
)
const answerMap = Object.fromEntries(orderedV16Tasks.map((task) => [
  task.id,
  Object.fromEntries(task.items.map((item, index) => [String(index), item.correctAnswer])),
]))

/** Long, exact answer-only representations; ordinary A–F option IDs are not treated as leaks. */
export const canonicalAnswerRepresentations = [
  JSON.stringify(canonicalAnswers),
  JSON.stringify(canonicalAnswersByTask),
  JSON.stringify(answerTupleList),
  JSON.stringify(answerMap),
  canonicalAnswers.join(''),
]

function encodedRepresentations(value) {
  // The raw form catches minified arrays/text; the escaped form catches JSON string literals.
  return [value, JSON.stringify(value).slice(1, -1)]
}

export function findStudentBundleLeaks(artifact) {
  const leaks = [
    ...forbiddenMarkers
      .filter((marker) => artifact.includes(marker))
      .map((marker) => `forbidden marker ${marker}`),
    ...(canonicalAnswerRepresentations.some((representation) =>
      encodedRepresentations(representation).some((candidate) => artifact.includes(candidate)),
    ) ? ['canonical answer vector'] : []),
    ...(canonicalExplanations.some((explanation) =>
      encodedRepresentations(explanation).some((candidate) => artifact.includes(candidate)),
    ) ? ['canonical explanation text'] : []),
  ]
  return [...new Set(leaks)]
}

export function assertSafeStudentArtifact(artifact) {
  const leaks = findStudentBundleLeaks(artifact)
  if (leaks.length > 0) throw new Error(`Unsafe student bundle: ${leaks.join(', ')}`)
}
