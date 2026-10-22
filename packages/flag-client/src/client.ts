import { applyEvent, evaluate, evaluateAll, type FlagEvent, type Snapshot } from '@flagflow/shared';
import { parseSse } from './sse.js';

export interface FlagClientOptions {
  /** FlagFlow API origin, e.g. http://localhost:4000 */
  baseUrl: string;
  /** Org API key. Server-side only: never ship it to a browser. */
  apiKey: string;
  /** Called with the new rule set after the initial snapshot and after every change. */
  onChange?: (snapshot: Snapshot, event?: FlagEvent) => void;
  /** Called on connection problems; the client keeps retrying unless the key is rejected. */
  onError?: (error: Error) => void;
  /** Reconnect backoff bounds, in milliseconds. */
  minRetryMs?: number;
  maxRetryMs?: number;
  fetch?: typeof fetch;
}

/** The key was rejected (invalid, revoked, or org disabled). The client stops; retrying can't help. */
export class FlagClientAuthError extends Error {
  override name = 'FlagClientAuthError';
}

/**
 * Keeps an org's flag rules in memory, kept current by /v1/stream, and evaluates locally.
 * Lookups never throw and never wait: before the first snapshot, and for unknown flags, everything is off.
 */
export class FlagClient {
  private snapshot: Snapshot | null = null;
  private readonly controller = new AbortController();
  private closed = false;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(private readonly options: FlagClientOptions) {
    this.fetchImpl = options.fetch ?? fetch;
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
  }

  /** Loads the snapshot, then follows the stream in the background. Rejects if the first load fails. */
  async start(): Promise<void> {
    const res = await this.request('/v1/snapshot');
    this.setSnapshot((await res.json()) as Snapshot);
    void this.follow();
  }

  /** Whether `key` is on for `userId`. False for unknown flags, before start(), and after errors. */
  isEnabled(key: string, userId: string): boolean {
    return evaluate(
      this.snapshot?.flags.find((f) => f.key === key),
      userId,
    );
  }

  /** Every flag's value for `userId`. */
  getAll(userId: string): Record<string, boolean> {
    return this.snapshot ? evaluateAll(this.snapshot, userId) : {};
  }

  get version(): number | null {
    return this.snapshot?.version ?? null;
  }

  get ready(): boolean {
    return this.snapshot !== null;
  }

  close() {
    this.closed = true;
    this.controller.abort();
  }

  private async request(path: string, headers: Record<string, string> = {}) {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      headers: { 'x-api-key': this.options.apiKey, ...headers },
      signal: this.controller.signal,
    });
    if (res.status === 401 || res.status === 403) {
      throw new FlagClientAuthError(`FlagFlow rejected the API key (${res.status})`);
    }
    if (!res.ok) throw new Error(`FlagFlow responded ${res.status} for ${path}`);
    return res;
  }

  private setSnapshot(snapshot: Snapshot, event?: FlagEvent) {
    this.snapshot = snapshot;
    this.options.onChange?.(snapshot, event);
  }

  private async follow() {
    let attempt = 0;
    while (!this.closed) {
      try {
        const res = await this.request('/v1/stream', {
          accept: 'text/event-stream',
          ...(this.snapshot && { 'last-event-id': String(this.snapshot.version) }),
        });
        attempt = 0;
        for await (const msg of parseSse(res.body!)) {
          if (msg.event === 'snapshot') {
            this.setSnapshot(JSON.parse(msg.data) as Snapshot);
          } else if (msg.event === 'flag.updated' || msg.event === 'flag.deleted') {
            const event = JSON.parse(msg.data) as FlagEvent;
            if (this.snapshot) this.setSnapshot(applyEvent(this.snapshot, event), event);
          } else if (msg.event === 'error') {
            const { code } = JSON.parse(msg.data) as { code?: string };
            if (code === 'API_KEY_REVOKED') throw new FlagClientAuthError('The API key was revoked');
          }
        }
        if (!this.closed) throw new Error('FlagFlow stream ended');
      } catch (err) {
        if (this.closed) return;
        const error = err instanceof Error ? err : new Error(String(err));
        this.options.onError?.(error);
        if (error instanceof FlagClientAuthError) {
          this.closed = true;
          return;
        }
      }
      await this.backoff(attempt++);
    }
  }

  private backoff(attempt: number) {
    const min = this.options.minRetryMs ?? 500;
    const max = this.options.maxRetryMs ?? 30_000;
    const delay = Math.min(max, min * 2 ** attempt) * (0.5 + Math.random() / 2);
    return new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, delay);
      this.controller.signal.addEventListener('abort', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}

export function createFlagClient(options: FlagClientOptions): FlagClient {
  return new FlagClient(options);
}
