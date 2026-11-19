import { expect, onTestFinished, vi } from 'vitest';

/**
 * Records the `reset` listeners that a render adds to `target`. The root of a field and the field
 * part of a picker each listen for the reset of the form, and the order of their registration is
 * the order in which they hear of it. Call it before the render.
 */
export function recordResetListeners(target: EventTarget) {
  const spy = vi.spyOn(target, 'addEventListener');
  onTestFinished(() => {
    spy.mockRestore();
  });

  return {
    /**
     * Registers the recorded listeners again in the opposite order, so that the last listener
     * hears of the next reset first.
     * @param count The count of the listeners that the render added. The call fails for another
     * count, so the order that a case tests is the order that it names.
     */
    reverse(count: number) {
      const added = spy.mock.calls.filter(([type]) => type === 'reset');
      expect(added).toHaveLength(count);
      spy.mockRestore();
      for (const [type, listener, options] of added) {
        target.removeEventListener(type, listener, options);
      }
      for (const [type, listener, options] of [...added].reverse()) {
        target.addEventListener(type, listener, options);
      }
    },
  };
}
