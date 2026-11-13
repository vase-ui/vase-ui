import { toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { useLabelableContext } from './LabelableContext';
import { useRegisteredId } from './useRegisteredId';

/**
 * A part that describes the control calls it in `setup`, such as a description or an error.
 * The control then has the `id` in its `aria-describedby`.
 * An empty or absent `id` registers nothing.
 */
export function useRegisteredMessageId(id: MaybeRefOrGetter<string | undefined>): void {
  const { setMessageIds } = useLabelableContext();
  let registeredId: string | undefined;

  function register(nextId: string | undefined) {
    const previousId = registeredId;
    if (nextId === previousId) {
      return;
    }

    registeredId = nextId;
    setMessageIds((ids) => {
      const next = ids.slice();
      // Remove one entry, not each entry with this value. Another part can have the same id, and
      // Vue can mount that part before it unmounts this part.
      const index = previousId === undefined ? -1 : next.indexOf(previousId);
      if (index !== -1) {
        next.splice(index, 1);
      }
      if (nextId !== undefined) {
        next.push(nextId);
      }
      return next;
    });
  }

  useRegisteredId(() => toValue(id) || undefined, register);
}
