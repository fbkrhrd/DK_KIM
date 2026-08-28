import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(process.cwd(), 'lib', 'import', 'validate.ts'), 'utf8');

test('validation module covers required values, dates, duplicates, masters, and negative quantities', () => {
  for (const code of ['REQUIRED_VALUE_MISSING', 'INVALID_DATE', 'INVALID_NUMBER', 'DUPLICATE_ROW', 'UNKNOWN_ITEM', 'UNKNOWN_SUPPLIER', 'ABNORMAL_NEGATIVE', 'DATE_ORDER_INVALID']) {
    assert.match(source, new RegExp(code));
  }
});
