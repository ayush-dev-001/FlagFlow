import { describe, expect, it } from 'vitest';
import { applyEvent, evaluateAll, type Snapshot } from './snapshot.js';

const base: Snapshot = {
  version: 5,
  flags: [
    { key: 'dark_mode', enabled: true, targetAll: false, targets: ['U001'] },
    { key: 'chat_widget', enabled: true, targetAll: true, targets: [] },
  ],
};

describe('evaluateAll', () => {
  it('evaluates every flag for a user', () => {
    expect(evaluateAll(base, 'U001')).toEqual({ dark_mode: true, chat_widget: true });
    expect(evaluateAll(base, 'U002')).toEqual({ dark_mode: false, chat_widget: true });
  });
});

describe('applyEvent', () => {
  it('replaces an updated flag and adds a new one', () => {
    const next = applyEvent(base, {
      type: 'flag.updated',
      version: 6,
      flag: { key: 'dark_mode', enabled: false, targetAll: false, targets: [] },
    });
    expect(next.version).toBe(6);
    expect(evaluateAll(next, 'U001').dark_mode).toBe(false);

    const added = applyEvent(next, {
      type: 'flag.updated',
      version: 7,
      flag: { key: 'beta_banner', enabled: true, targetAll: true, targets: [] },
    });
    expect(added.flags.map((f) => f.key).sort()).toEqual(['beta_banner', 'chat_widget', 'dark_mode']);
  });

  it('removes a deleted flag', () => {
    const next = applyEvent(base, { type: 'flag.deleted', version: 6, key: 'chat_widget' });
    expect(next.flags.map((f) => f.key)).toEqual(['dark_mode']);
  });

  it('ignores stale or duplicate events', () => {
    const stale = applyEvent(base, { type: 'flag.deleted', version: 5, key: 'dark_mode' });
    expect(stale).toBe(base);
  });
});
