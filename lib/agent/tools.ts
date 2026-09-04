export type AgentRole = 'USER' | 'ADMIN';

export type ToolResult = {
  ok: boolean;
  data: Record<string, unknown> | null;
  numbers: Record<string, number>;
  dataAsOf: string | null;
  reason: string | null;
};

type JsonSchema = {
  type: 'object';
  properties: Record<string, { type: string | string[] }>;
  required: string[];
  additionalProperties: false;
};

export type AgentTool = {
  name: string;
  description: string;
  parameters: JsonSchema;
  roles: readonly AgentRole[];
  run: (input: Record<string, unknown>, role: AgentRole) => Promise<ToolResult>;
};

type QueryResult = { rows: unknown[]; error: string | null };

type ScmQueries = {
  getShipmentTrend: (itemCode: string) => Promise<QueryResult>;
  getDemandProfile: (itemCode: string) => Promise<QueryResult>;
  getOlAccuracy: (modelBase: string, fy?: string | null) => Promise<QueryResult>;
  getBomRequirement: (modelBase: string) => Promise<QueryResult>;
};

export type ScmQueryLoader = () => Promise<ScmQueries>;

const itemCodeSchema: JsonSchema = {
  type: 'object',
  properties: { itemCode: { type: 'string' } },
  required: ['itemCode'],
  additionalProperties: false,
};

const modelBaseSchema: JsonSchema = {
  type: 'object',
  properties: { modelBase: { type: 'string' } },
  required: ['modelBase'],
  additionalProperties: false,
};

const olAccuracySchema: JsonSchema = {
  type: 'object',
  properties: {
    modelBase: { type: 'string' },
    fy: { type: ['string', 'null'] },
  },
  required: ['modelBase', 'fy'],
  additionalProperties: false,
};

function unavailable(reason: string): ToolResult {
  return { ok: false, data: null, numbers: {}, dataAsOf: null, reason };
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function requiredString(input: Record<string, unknown>, key: string): string | null {
  const value = input[key];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function nullableString(input: Record<string, unknown>, key: string): string | null | undefined {
  const value = input[key];
  if (value === undefined || value === null) return null;
  return typeof value === 'string' ? value : undefined;
}

function numericValues(value: unknown, path = '', target: Record<string, number> = {}): Record<string, number> {
  if (typeof value === 'number' && Number.isFinite(value)) {
    target[path || 'value'] = value;
    return target;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => numericValues(entry, `${path}[${index}]`, target));
    return target;
  }
  const object = record(value);
  if (object) {
    Object.entries(object).forEach(([key, entry]) => numericValues(entry, path ? `${path}.${key}` : key, target));
  }
  return target;
}

function resultFrom(query: QueryResult, missingReason: string): ToolResult {
  if (query.error) return unavailable(query.error);
  const data = record(query.rows[0]);
  if (!data) return unavailable(missingReason);
  const dataAsOf = typeof data.dataAsOf === 'string' ? data.dataAsOf : null;
  const reason = typeof data.reason === 'string' ? data.reason : null;
  return { ok: true, data, numbers: numericValues(data), dataAsOf, reason };
}

async function loadScmQueries(loader?: ScmQueryLoader): Promise<ScmQueries> {
  // Keep this dynamic: Node's test loader must not load the Supabase client for agent-only tests.
  return loader ? await loader() : await import('../scm');
}

function tool(
  name: string,
  description: string,
  parameters: JsonSchema,
  execute: (scm: ScmQueries, input: Record<string, unknown>) => Promise<QueryResult | ToolResult>,
  loader?: ScmQueryLoader,
): AgentTool {
  return {
    name,
    description,
    parameters,
    roles: ['USER', 'ADMIN'],
    async run(input, role) {
      if (!this.roles.includes(role)) return unavailable('FORBIDDEN');
      const scm = await loadScmQueries(loader);
      const response = await execute(scm, input);
      if ('ok' in response) return response;
      return resultFrom(response, name.includes('shipment') || name.includes('demand') ? 'ITEM_NOT_FOUND' : 'MODEL_NOT_FOUND');
    },
  };
}

export function createAgentTools(loader?: ScmQueryLoader): AgentTool[] {
  return [
    tool('get_shipment_trend', '품목의 HOC 기준 월별 출고량과 최근 평균을 조회합니다.', itemCodeSchema, async (scm, input) => {
      const itemCode = requiredString(input, 'itemCode');
      return itemCode ? scm.getShipmentTrend(itemCode) : unavailable('INVALID_ITEM_CODE');
    }, loader),
    tool('get_demand_profile', '품목의 출고 이력 기반 수요유형과 변동성을 조회합니다.', itemCodeSchema, async (scm, input) => {
      const itemCode = requiredString(input, 'itemCode');
      return itemCode ? scm.getDemandProfile(itemCode) : unavailable('INVALID_ITEM_CODE');
    }, loader),
    tool('get_ol_accuracy', '기종별 Sales OL과 SCM OL의 실적 대비 정확도를 조회합니다.', olAccuracySchema, async (scm, input) => {
      const modelBase = requiredString(input, 'modelBase');
      const fy = nullableString(input, 'fy');
      if (!modelBase || fy === undefined) return unavailable('INVALID_MODEL_BASE_OR_FY');
      return scm.getOlAccuracy(modelBase, fy);
    }, loader),
    tool('get_bom_requirement', '기종 1대 판매 기준 CAP, 필수 옵션, SCC 구성과 BOM 수량을 조회합니다.', modelBaseSchema, async (scm, input) => {
      const modelBase = requiredString(input, 'modelBase');
      return modelBase ? scm.getBomRequirement(modelBase) : unavailable('INVALID_MODEL_BASE');
    }, loader),
  ];
}

export const agentTools = createAgentTools();
