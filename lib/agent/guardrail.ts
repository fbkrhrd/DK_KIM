import type { AgentAnswer } from './schema.ts';
import type { ToolResult } from './tools.ts';

export type NumericClaim = {
  field: string;
  raw: string;
  value: number;
  isPercent: boolean;
  decimalPlaces: number;
};

export type NamedToolResult = { toolName: string; result: ToolResult };

export type NumberValidation = {
  ok: boolean;
  allowed: Record<string, number>;
  unsupported: NumericClaim[];
};

const numberPattern = /(^|[^A-Za-z0-9])(-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?)/g;

function withoutIdentifiers(text: string): string {
  return text
    .replace(/\b\d{4}-\d{2}(?:-\d{2})?\b/g, ' ')
    .replace(/\b(?:MDL\d+|\d+K\d+|P\d+)\b/gi, ' ')
    .replace(/(^|\n)\s*\d+[.)]\s*/g, '$1');
}

function claimsFromText(field: string, text: string): NumericClaim[] {
  const claims: NumericClaim[] = [];
  const normalized = withoutIdentifiers(text).replace(/−/g, '-');
  numberPattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = numberPattern.exec(normalized)) !== null) {
    const raw = match[2];
    const isPercent = raw.endsWith('%');
    const numeric = raw.replace(/[% ,]/g, '');
    const value = Number(numeric);
    if (!Number.isFinite(value)) continue;
    const decimal = numeric.split('.')[1];
    claims.push({ field, raw, value, isPercent, decimalPlaces: decimal ? decimal.length : 0 });
  }
  return claims;
}

export function extractAnswerNumbers(answer: AgentAnswer): NumericClaim[] {
  const claims = [
    ...claimsFromText('answer', answer.answer),
    ...claimsFromText('verdict', answer.verdict ?? ''),
    ...claimsFromText('recommended_action', answer.recommended_action ?? ''),
  ];
  answer.evidence.forEach((evidence, index) => {
    claims.push(...claimsFromText(`evidence[${index}].label`, evidence.source));
    claims.push(...claimsFromText(`evidence[${index}].summary`, evidence.summary));
    claims.push(...claimsFromText(`evidence[${index}].value`, evidence.value === null ? '' : String(evidence.value)));
    claims.push(...claimsFromText(`evidence[${index}].reason`, evidence.reason_code ?? ''));
  });
  return claims;
}

export function buildAllowedNumbers(results: NamedToolResult[]): Record<string, number> {
  const allowed: Record<string, number> = {};
  for (const { toolName, result } of results) {
    for (const [key, value] of Object.entries(result.numbers)) {
      if (typeof value === 'number' && Number.isFinite(value)) allowed[`${toolName}.${key}`] = value;
    }
  }
  return allowed;
}

function rounded(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function equalWithinPrecision(claim: NumericClaim, source: number): boolean {
  if (claim.isPercent) {
    if (source < 0 || source > 1) return false;
    return rounded(source * 100, claim.decimalPlaces) === claim.value;
  }
  return rounded(source, claim.decimalPlaces) === claim.value;
}

export function validateAnswerNumbers(answer: AgentAnswer, allowed: Record<string, number>): NumberValidation {
  const unsupported = extractAnswerNumbers(answer).filter((claim) => !Object.values(allowed).some((value) => equalWithinPrecision(claim, value)));
  return { ok: unsupported.length === 0, allowed, unsupported };
}
