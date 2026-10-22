export interface SseMessage {
  event: string;
  data: string;
  id?: string;
}

/**
 * Parses a text/event-stream body into messages. Chunks may split lines anywhere; comments
 * (heartbeats) are skipped; multi-line `data:` fields are joined with newlines.
 */
export async function* parseSse(body: AsyncIterable<Uint8Array>): AsyncGenerator<SseMessage> {
  const decoder = new TextDecoder();
  let buffer = '';
  let event = 'message';
  let data: string[] = [];
  let id: string | undefined;

  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let newline: number;
    while ((newline = buffer.search(/\r\n|\r|\n/)) !== -1) {
      // A trailing \r may be the first half of a \r\n split across chunks: wait for the next chunk.
      if (newline === buffer.length - 1 && buffer.endsWith('\r')) break;
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + (buffer.startsWith('\r\n', newline) ? 2 : 1));

      if (line === '') {
        if (data.length > 0) yield { event, data: data.join('\n'), ...(id !== undefined && { id }) };
        event = 'message';
        data = [];
        id = undefined;
        continue;
      }
      if (line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
      if (field === 'event') event = value;
      else if (field === 'data') data.push(value);
      else if (field === 'id') id = value;
    }
  }
}
