/**
 * Token estimation based on the actual clipboard payload
 * (AI Instruction + ProjectContext JSON), with a configurable
 * chars-per-token rule.
 */

import {
  buildCopyPayload,
  serializeProjectContext,
  AI_INSTRUCTION,
  type ProjectContext,
} from './types'

export const DEFAULT_CHARS_PER_TOKEN = 4

export interface TokenEstimate {
  /** Full copy payload length (instruction + separator + JSON) */
  payloadChars: number
  instructionChars: number
  jsonChars: number
  estimatedTokens: number
}

/** Clamp and sanitize user-configured chars-per-token. */
export function normalizeCharsPerToken(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_CHARS_PER_TOKEN
  return Math.min(64, Math.max(1, value))
}

export function estimateTokensFromChars(
  chars: number,
  charsPerToken: number = DEFAULT_CHARS_PER_TOKEN
): number {
  const cpt = normalizeCharsPerToken(charsPerToken)
  if (chars <= 0) return 0
  return Math.ceil(chars / cpt)
}

/**
 * Estimate tokens from the exact string that Copy Context writes to clipboard.
 * Includes AI instruction so empty-content structure-only contexts still count.
 */
export function estimateContextTokens(
  context: ProjectContext,
  charsPerToken: number = DEFAULT_CHARS_PER_TOKEN
): TokenEstimate {
  const payload = buildCopyPayload(context)
  const json = serializeProjectContext(context)
  const payloadChars = payload.length
  return {
    payloadChars,
    instructionChars: AI_INSTRUCTION.length,
    jsonChars: json.length,
    estimatedTokens: estimateTokensFromChars(payloadChars, charsPerToken),
  }
}

/** Project-wide baseline tokens from total file bytes (structure+files on disk). */
export function estimateProjectTokens(
  projectTotalBytes: number,
  charsPerToken: number = DEFAULT_CHARS_PER_TOKEN
): number {
  return estimateTokensFromChars(Math.max(0, projectTotalBytes), charsPerToken)
}

export function reductionPercent(
  contextTokens: number,
  projectTokens: number
): number {
  if (projectTokens <= 0) return 0
  const pct = (1 - contextTokens / projectTokens) * 100
  return Math.max(0, Math.min(100, pct))
}
