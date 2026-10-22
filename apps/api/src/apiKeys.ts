import { randomBytes } from 'node:crypto';
import { sha256 } from './auth/tokens.js';

const PREFIX_LENGTH = 'ff_live_'.length + 4;

/** A new org API key. `key` is shown to the user once; only `hash` and the display `prefix` are stored. */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `ff_live_${randomBytes(24).toString('base64url')}`;
  return { key, prefix: key.slice(0, PREFIX_LENGTH), hash: sha256(key) };
}
