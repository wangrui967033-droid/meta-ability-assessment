import { SubmissionValidationError } from './score-assessment'
import type { AssessmentSubmissionPayload } from '../src/lib/transport'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function invalidMetadata(): never {
  throw new SubmissionValidationError('作答元数据无效')
}

function finiteNonNegativeNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) invalidMetadata()
  return value
}

function nonNegativeInteger(value: unknown): number {
  const number = finiteNonNegativeNumber(value)
  if (!Number.isInteger(number)) invalidMetadata()
  return number
}

function positiveInteger(value: unknown): number {
  const number = nonNegativeInteger(value)
  if (number < 1) invalidMetadata()
  return number
}

function positiveIntegerOrNull(value: unknown): number | null {
  return value === null ? null : positiveInteger(value)
}

function stringOrNull(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string') invalidMetadata()
  return value
}

function validatedSelectionEvents(value: unknown): unknown[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) invalidMetadata()

  return value.map((event) => {
    if (!isRecord(event) || typeof event.optionId !== 'string') invalidMetadata()
    return {
      itemIndex: nonNegativeInteger(event.itemIndex),
      optionId: event.optionId,
      elapsedSinceTaskStartMs: finiteNonNegativeNumber(event.elapsedSinceTaskStartMs),
    }
  })
}

const OPTION_AUDIT_MODES = new Set([
  'shuffle',
  'diagram-labels',
  'diagram-shuffle',
  'spatial-fixed',
])

function validatedOptionAudit(value: unknown): unknown[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) invalidMetadata()

  return value.map((audit) => {
    if (
      !isRecord(audit) ||
      typeof audit.mode !== 'string' ||
      !OPTION_AUDIT_MODES.has(audit.mode) ||
      !Array.isArray(audit.options)
    ) {
      invalidMetadata()
    }

    const options = audit.options.map((option) => {
      if (
        !isRecord(option) ||
        typeof option.originalId !== 'string' ||
        typeof option.displayId !== 'string' ||
        (option.spatialPosition !== undefined && typeof option.spatialPosition !== 'string')
      ) {
        invalidMetadata()
      }
      return {
        originalId: option.originalId,
        originalPosition: positiveInteger(option.originalPosition),
        displayPosition: positiveInteger(option.displayPosition),
        displayId: option.displayId,
        ...(option.spatialPosition !== undefined
          ? { spatialPosition: option.spatialPosition }
          : {}),
      }
    })

    return {
      itemIndex: nonNegativeInteger(audit.itemIndex),
      mode: audit.mode,
      options,
      selectedOriginalId: stringOrNull(audit.selectedOriginalId),
      selectedOriginalPosition: positiveIntegerOrNull(audit.selectedOriginalPosition),
      selectedDisplayPosition: positiveIntegerOrNull(audit.selectedDisplayPosition),
      selectedDisplayId: stringOrNull(audit.selectedDisplayId),
    }
  })
}

function elapsedNumberOrNull(value: unknown): number | null {
  return value === null ? null : finiteNonNegativeNumber(value)
}

function validatedMemoryInterval(value: unknown): unknown | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value) || typeof value.presentationId !== 'string') invalidMetadata()

  return {
    presentationId: value.presentationId,
    submittedAt: finiteNonNegativeNumber(value.submittedAt),
    elapsedToTaskMs: elapsedNumberOrNull(value.elapsedToTaskMs),
    elapsedToSubmitMs: elapsedNumberOrNull(value.elapsedToSubmitMs),
  }
}

export function allowedRawResponses(payload: unknown): unknown[] {
  return (payload as AssessmentSubmissionPayload).responses.map((item) => {
    const selectionEvents = validatedSelectionEvents(item.response.selectionEvents)
    const optionAudit = validatedOptionAudit(item.optionAudit)
    const memoryInterval = validatedMemoryInterval(item.memoryInterval)
    if (item.submittedAt !== undefined && typeof item.submittedAt !== 'string') invalidMetadata()

    return {
      position: item.position,
      response: {
        kind: item.response.kind,
        answers: { ...item.response.answers },
        ...(selectionEvents !== undefined ? { selectionEvents } : {}),
      },
      ...(item.durationMs !== undefined ? { durationMs: item.durationMs } : {}),
      ...(item.submittedAt !== undefined ? { submittedAt: item.submittedAt } : {}),
      ...(optionAudit !== undefined ? { optionAudit } : {}),
      ...(memoryInterval !== undefined ? { memoryInterval } : {}),
    }
  })
}


