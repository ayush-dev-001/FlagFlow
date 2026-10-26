import { existsSync } from 'node:fs';
import { createFlagClient, FlagClientAuthError } from '@flagflow/flag-client';
import { createDemoApp } from './app.js';
import type { FlagChange, FlagSource, LinkState } from './flags.js';

if (existsSync('.env')) process.loadEnvFile('.env');

const port = Number(process.env.PORT ?? 4100);
const baseUrl = process.env.FLAGFLOW_URL ?? 'http://localhost:4000';
const apiKey = process.env.FLAGFLOW_API_KEY ?? '';
const webOrigin = process.env.DEMO_WEB_ORIGIN ?? 'http://localhost:5174';

/** flag-client behind the FlagSource interface, tracking whether the stream is healthy. */
function flagClientSource(): FlagSource & { start(): Promise<void> } {
  const listeners = new Set<(change?: FlagChange) => void>();
  const emit = (change?: FlagChange) => {
    for (const l of listeners) l(change);
  };
  let state: LinkState = apiKey ? 'connecting' : 'unconfigured';

  const client = createFlagClient({
    baseUrl,
    apiKey,
    onChange: (_snapshot, event) => {
      state = 'live';
      emit(
        event && {
          type: event.type,
          key: event.type === 'flag.updated' ? event.flag.key : event.key,
          version: event.version,
        },
      );
    },
    onError: (err) => {
      state = err instanceof FlagClientAuthError ? 'rejected' : 'reconnecting';
      console.warn(`FlagFlow: ${err.message}`);
      emit();
    },
  });

  return {
    state: () => state,
    version: () => client.version,
    evaluate: (userId) => client.getAll(userId),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async start() {
      if (!apiKey) {
        console.warn('FLAGFLOW_API_KEY is not set: every flag is off. Run `npm run demo:key` to create one.');
        return;
      }
      // Keep trying: the demo should come up even when FlagFlow starts after it.
      for (let attempt = 0; ; attempt++) {
        try {
          await client.start();
          return;
        } catch (err) {
          state = err instanceof FlagClientAuthError ? 'rejected' : 'reconnecting';
          emit();
          if (err instanceof FlagClientAuthError) {
            console.error('FlagFlow rejected FLAGFLOW_API_KEY. Run `npm run demo:key` to create a new one.');
            return;
          }
          await new Promise((r) => setTimeout(r, Math.min(10_000, 500 * 2 ** attempt)));
        }
      }
    },
  };
}

const flags = flagClientSource();
createDemoApp({ flags, webOrigin }).listen(port, () => {
  console.log(`demo-api listening on http://localhost:${port}`);
});
void flags.start();
