import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildOpenApi } from './openapi.js';

describe('postman/specs/flagflow-api.openapi.json', () => {
  it('matches the spec the API serves (run `npm run openapi` after changing routes)', () => {
    const committed = JSON.parse(
      readFileSync(
        join(import.meta.dirname, '..', '..', '..', 'postman', 'specs', 'flagflow-api.openapi.json'),
        'utf8',
      ),
    ) as unknown;
    expect(committed).toEqual(JSON.parse(JSON.stringify(buildOpenApi())));
  });
});
