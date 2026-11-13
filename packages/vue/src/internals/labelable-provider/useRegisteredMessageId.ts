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
  const { registerMessageId } = useLabelableContext();
  const source = Symbol();

  useRegisteredId(
    () => toValue(id) || undefined,
    (getId) => registerMessageId(source, getId),
  );
}
