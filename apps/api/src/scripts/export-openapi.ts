// Writes the OpenAPI spec the API serves at /api/docs to postman/specs/flagflow-api.openapi.json, so tools (Postman, ZAP,
// reviewers) can read it from the repo. `openapi.test.ts` fails when the file is out of date.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildOpenApi } from '../openapi.js';

const out = join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  'postman',
  'specs',
  'flagflow-api.openapi.json',
);
writeFileSync(out, `${JSON.stringify(buildOpenApi(), null, 2)}\n`);
console.log(`wrote ${out}`);
