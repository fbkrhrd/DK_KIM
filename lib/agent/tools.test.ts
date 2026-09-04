import assert from 'node:assert/strict';
import test from 'node:test';
import { createAgentTools } from './tools.ts';

const tools = createAgentTools(async () => ({
  getShipmentTrend: async () => ({ rows: [], error: null }),
  getDemandProfile: async () => ({
    rows: [{
      itemCode: 'ITEM-NO-HISTORY',
      monthlyQty: [],
      avg3m: null,
      avg6m: null,
      avg12m: null,
      observedMonths: 4,
      latestYm: null,
      latestQty: null,
      dataAsOf: null,
      reason: 'INSUFFICIENT_HISTORY',
    }],
    error: null,
  }),
  getOlAccuracy: async () => ({ rows: [], error: null }),
  getBomRequirement: async () => ({ rows: [], error: null }),
}));

test('defines four uniquely named tools with strict JSON Schema parameters', () => {
  assert.equal(tools.length, 4);
  assert.equal(new Set(tools.map((tool) => tool.name)).size, tools.length);

  for (const tool of tools) {
    assert.equal(tool.parameters.type, 'object');
    assert.equal(tool.parameters.additionalProperties, false);
    assert.equal(tool.parameters.required.length, Object.keys(tool.parameters.properties).length);
    assert.ok(tool.description.length > 0);
  }
});

test('filters tool execution by role', async () => {
  const result = await tools[0].run({ itemCode: 'UNKNOWN' }, 'GUEST' as never);

  assert.deepEqual(result, {
    ok: false,
    data: null,
    numbers: {},
    dataAsOf: null,
    reason: 'FORBIDDEN',
  });
});

test('returns an explicit reason when an item does not exist', async () => {
  const shipmentTool = tools.find((tool) => tool.name === 'get_shipment_trend');
  if (!shipmentTool) throw new Error('Shipment tool not found');

  const result = await shipmentTool.run({ itemCode: 'UNKNOWN' }, 'USER');

  assert.deepEqual(result, {
    ok: false,
    data: null,
    numbers: {},
    dataAsOf: null,
    reason: 'ITEM_NOT_FOUND',
  });
});

test('preserves unavailable calculations and does not convert them to zero', async () => {
  const demandTool = tools.find((tool) => tool.name === 'get_demand_profile');
  if (!demandTool) throw new Error('Demand tool not found');

  const result = await demandTool.run({ itemCode: 'ITEM-NO-HISTORY' }, 'USER');

  assert.equal(result.ok, true);
  assert.equal(result.reason, 'INSUFFICIENT_HISTORY');
  assert.equal(result.numbers.observedMonths, 4);
  assert.equal('avg3m' in result.numbers, false);
});
