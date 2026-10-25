import { type FocusEvent, type FormEvent, useCallback, useState } from 'react';
import type { FormMirror, MirrorStatus } from './LoginIllustration';

/**
 * Tracks what the illustration's monitor should show. Only lengths are kept, never the values: the
 * password itself never leaves its input. Spread `handlers` on the <form>; focus and input events bubble.
 */
export function useFormMirror(status: MirrorStatus) {
  const [state, setState] = useState<Omit<FormMirror, 'status'>>({ field1: 0, field2: 0, focus: 0 });

  // Line 1 is every text field together (register has three), so moving between them never empties it.
  const read = (target: EventTarget, form: HTMLFormElement) => {
    if (!(target instanceof HTMLInputElement) || target.type === 'checkbox') return null;
    if (target.type === 'password') return { slot: 2 as const, length: target.value.length };
    const texts = [...form.querySelectorAll('input')].filter(
      (i) => i.type !== 'password' && i.type !== 'checkbox',
    );
    return { slot: 1 as const, length: texts.reduce((n, i) => n + i.value.length, 0) };
  };

  const onFocus = useCallback((e: FocusEvent<HTMLFormElement>) => {
    const hit = read(e.target, e.currentTarget);
    if (!hit) return;
    setState((s) => ({ ...s, focus: hit.slot, [hit.slot === 1 ? 'field1' : 'field2']: hit.length }));
  }, []);

  const onInput = useCallback((e: FormEvent<HTMLFormElement>) => {
    const hit = read(e.target, e.currentTarget);
    if (!hit) return;
    setState((s) => ({ ...s, [hit.slot === 1 ? 'field1' : 'field2']: hit.length }));
  }, []);

  const onBlur = useCallback(() => setState((s) => ({ ...s, focus: 0 })), []);

  return { mirror: { ...state, status } satisfies FormMirror, handlers: { onFocus, onInput, onBlur } };
}
