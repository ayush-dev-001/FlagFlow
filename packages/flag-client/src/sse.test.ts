import { describe, expect, it } from 'vitest';
import { parseSse, type SseMessage } from './sse.js';

async function* chunks(...parts: string[]) {
  const encoder = new TextEncoder();
  for (const p of parts) {
    await Promise.resolve();
    yield encoder.encode(p);
  }
}

const collect = async (body: AsyncIterable<Uint8Array>) => {
  const out: SseMessage[] = [];
  for await (const m of parseSse(body)) out.push(m);
  return out;
};

describe('parseSse', () => {
  it('parses events with ids, skipping heartbeats', async () => {
    const msgs = await collect(
      chunks('id: 7\nevent: snapshot\ndata: {"version":7}\n\n: ping\n\nevent: flag.updated\ndata: {}\n\n'),
    );
    expect(msgs).toEqual([
      { event: 'snapshot', data: '{"version":7}', id: '7' },
      { event: 'flag.updated', data: '{}' },
    ]);
  });

  it('handles events split across arbitrary chunk boundaries and CRLF', async () => {
    const msgs = await collect(chunks('ev', 'ent: a\r', '\ndata: hel', 'lo\r\n', '\r\n'));
    expect(msgs).toEqual([{ event: 'a', data: 'hello' }]);
  });

  it('joins multi-line data and defaults the event name', async () => {
    const msgs = await collect(chunks('data: line 1\ndata: line 2\n\n'));
    expect(msgs).toEqual([{ event: 'message', data: 'line 1\nline 2' }]);
  });

  it('decodes multi-byte characters split between chunks', async () => {
    const bytes = new TextEncoder().encode('data: héllo\n\n');
    async function* split() {
      await Promise.resolve();
      yield bytes.slice(0, 8);
      yield bytes.slice(8);
    }
    expect(await collect(split())).toEqual([{ event: 'message', data: 'héllo' }]);
  });
});
