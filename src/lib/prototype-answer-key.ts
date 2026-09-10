import type { TaskResponse } from '../data/assessment-types'
import { orderedV15Tasks } from '../data/meta-bank-v1.5'
import { orderedV16Tasks } from '../data/meta-bank-v1.6'

/** Development-only answer key. Production builds must replace this with server scoring. */
export const prototypeAnswerKey: Record<string, TaskResponse> = {
  'M-F-01R': { kind: 'choice', selectedId: 'a' }, 'L-U-01': { kind: 'choice', selectedId: 'a' }, 'CR-A1-T': { kind: 'choice', selectedId: 'a' }, 'ML-QS-01R': { kind: 'choice', selectedId: 'b' }, 'CR-B1-G': { kind: 'choice', selectedId: 'a' },
  'IN-RL-01R2': { kind: 'mapping', mapping: { jia: 'circle', yi: 'triangle', bing: 'square' } }, 'M-H-01': { kind: 'slots', slots: { A3: 'MEKA', A4: 'RISO' } }, 'SP-IM-08-NEW-01': { kind: 'composition', answerToken: 'outline-a' },
  'CR-C1-N': { kind: 'choice', selectedId: 'a' }, 'L-R-03R': { kind: 'slots', slots: { event: 'rain', change: 'place', stable: 'time' } }, 'CR-D2-S': { kind: 'sequence', ids: ['pentagon', 'diamond', 'triangle', 'circle'] }, 'ML-QR-01': { kind: 'choice', selectedId: 'c' },
  'M-R-01R': { kind: 'slots', slots: { A5: 'TAVU', A6: 'PENI' } }, 'IN-PT-03R': { kind: 'choice', selectedId: 'a' }, 'L-E-02R': { kind: 'sequence', ids: ['if', 'diamond', 'pause', 'but'] }, 'CR-A1-N': { kind: 'choice', selectedId: 'a' },
  'SP-ST-03': { kind: 'choice', selectedId: 'a' }, 'M-F-03R': { kind: 'choice', selectedId: 'a' }, 'CR-B1-T': { kind: 'choice', selectedId: 'a' }, 'IN-CL-02': { kind: 'choice', selectedId: 'a' },
  'ML-CH-02': { kind: 'choice', selectedId: 'a' }, 'CR-C1-P': { kind: 'choice', selectedId: 'a' }, 'SP-TR-01': { kind: 'choice', selectedId: 'a' }, 'M-H-04R': { kind: 'choice', selectedId: 'a' },
  'L-E-04R': { kind: 'sequence', ids: ['total', 'same', 'next', 'all'] }, 'CR-D2-C': { kind: 'sequence', ids: ['ding', 'bing', 'yi', 'jia'] }, 'ML-QS-04R': { kind: 'choice', selectedId: 'c' }, 'SP-IM-04': { kind: 'choice', selectedId: 'a' },
  'IN-RL-CTX-NEW-01': { kind: 'sequence', ids: ['jia', 'yi', 'bing', 'ding'] }, 'M-R-B-NEW-01': { kind: 'slots', slots: { B5: 'MULO', B6: 'TARI' } },
}

/** Local-preview key for the frozen V1.5 bank. Production must score server-side. */
export const v15AnswerKey: Record<string, TaskResponse> = Object.fromEntries(
  orderedV15Tasks.map((task) => [
    task.id,
    { kind: 'multi-choice', answers: Object.fromEntries(task.items.map((item, index) => [String(index), item.answer])) },
  ]),
)

/** Local-preview key for the audited V1.6 bank. Production must score server-side. */
export const v16AnswerKey: Record<string, TaskResponse> = Object.fromEntries(
  orderedV16Tasks.map((task) => [
    task.id,
    { kind: 'multi-choice', answers: Object.fromEntries(task.items.map((sourceItem, index) => [String(index), sourceItem.correctAnswer])) },
  ]),
)
