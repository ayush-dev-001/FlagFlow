import { describe, expect, it } from 'vitest';
import { evaluate, type FlagRule } from './evaluate.js';

const flag = (overrides: Partial<FlagRule> = {}): FlagRule => ({
  key: 'dark_mode',
  enabled: true,
  targetAll: false,
  targets: ['U001'],
  ...overrides,
});

describe('evaluate', () => {
  it('is false for an unknown flag', () => {
    expect(evaluate(undefined, 'U001')).toBe(false);
  });

  it('is false when the flag is off, even for targeted or all users', () => {
    expect(evaluate(flag({ enabled: false }), 'U001')).toBe(false);
    expect(evaluate(flag({ enabled: false, targetAll: true }), 'U001')).toBe(false);
  });

  it('is true only for targeted users when targetAll is off', () => {
    expect(evaluate(flag(), 'U001')).toBe(true);
    expect(evaluate(flag(), 'U002')).toBe(false);
  });

  it('is true for every user when targetAll is on', () => {
    expect(evaluate(flag({ targetAll: true, targets: [] }), 'U999')).toBe(true);
  });
});
