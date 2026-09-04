export type AgentEvidence = {
  source: string;
  summary: string;
  value: string | number | boolean | null;
  reason_code: string | null;
  data_as_of: string | null;
};

export type AgentRisk = 'SAFE' | 'WARNING' | 'CRITICAL' | 'CALCULATION_UNAVAILABLE' | null;

export type AgentAnswer = {
  answer: string;
  verdict: string | null;
  evidence: AgentEvidence[];
  data_as_of: string | null;
  risk: AgentRisk;
  recommended_action: string | null;
  cannot_answer: boolean;
  cannot_answer_reason: string | null;
};

export const agentAnswerJsonSchema = {
  name: 'agent_answer',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      answer: { type: 'string' },
      verdict: { type: ['string', 'null'] },
      evidence: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            source: { type: 'string' },
            summary: { type: 'string' },
            value: { type: ['string', 'number', 'boolean', 'null'] },
            reason_code: { type: ['string', 'null'] },
            data_as_of: { type: ['string', 'null'] },
          },
          required: ['source', 'summary', 'value', 'reason_code', 'data_as_of'],
          additionalProperties: false,
        },
      },
      data_as_of: { type: ['string', 'null'] },
      risk: { type: ['string', 'null'], enum: ['SAFE', 'WARNING', 'CRITICAL', 'CALCULATION_UNAVAILABLE', null] },
      recommended_action: { type: ['string', 'null'] },
      cannot_answer: { type: 'boolean' },
      cannot_answer_reason: { type: ['string', 'null'] },
    },
    required: [
      'answer',
      'verdict',
      'evidence',
      'data_as_of',
      'risk',
      'recommended_action',
      'cannot_answer',
      'cannot_answer_reason',
    ],
    additionalProperties: false,
  },
} as const;

const answerKeys = [
  'answer',
  'verdict',
  'evidence',
  'data_as_of',
  'risk',
  'recommended_action',
  'cannot_answer',
  'cannot_answer_reason',
] as const;

const evidenceKeys = ['source', 'summary', 'value', 'reason_code', 'data_as_of'] as const;
const riskValues = new Set<Exclude<AgentRisk, null>>(['SAFE', 'WARNING', 'CRITICAL', 'CALCULATION_UNAVAILABLE']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actualKeys = Object.keys(value);
  return actualKeys.length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isEvidence(value: unknown): value is AgentEvidence {
  if (!isRecord(value) || !hasExactKeys(value, evidenceKeys)) return false;
  return typeof value.source === 'string'
    && typeof value.summary === 'string'
    && (value.value === null || typeof value.value === 'string' || typeof value.value === 'number' || typeof value.value === 'boolean')
    && isNullableString(value.reason_code)
    && isNullableString(value.data_as_of);
}

function isAgentRisk(value: unknown): value is AgentRisk {
  return value === null || (typeof value === 'string' && riskValues.has(value as Exclude<AgentRisk, null>));
}

export function parseAgentAnswer(input: unknown): AgentAnswer | null {
  let value = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input) as unknown;
    } catch {
      return null;
    }
  }

  if (!isRecord(value) || !hasExactKeys(value, answerKeys)) return null;
  if (typeof value.answer !== 'string'
    || !isNullableString(value.verdict)
    || !Array.isArray(value.evidence)
    || !value.evidence.every(isEvidence)
    || !isNullableString(value.data_as_of)
    || !isAgentRisk(value.risk)
    || !isNullableString(value.recommended_action)
    || typeof value.cannot_answer !== 'boolean'
    || !isNullableString(value.cannot_answer_reason)) {
    return null;
  }

  if (value.cannot_answer && value.cannot_answer_reason === null) return null;
  if (!value.cannot_answer && value.cannot_answer_reason !== null) return null;

  return value as AgentAnswer;
}

export function cannotAnswer(reason: string, dataAsOf: string | null = null): AgentAnswer {
  return {
    answer: '답변할 수 없습니다.',
    verdict: null,
    evidence: [],
    data_as_of: dataAsOf,
    risk: 'CALCULATION_UNAVAILABLE',
    recommended_action: null,
    cannot_answer: true,
    cannot_answer_reason: reason,
  };
}
