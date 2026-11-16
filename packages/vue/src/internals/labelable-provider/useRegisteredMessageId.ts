import { toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { useLabelableContext } from './LabelableContext';
import { useRegisteredId } from './useRegisteredId';

/**
 * A part that describes the control calls it in `setup`, such as a description or an error.
 * The control then has the `id` in its `aria-describedby`.
 * An absent `id` registers nothing.
 * @param element The element of the part.
 */
export function useRegisteredMessageId(
  id: MaybeRefOrGetter<string | undefined>,
  element?: MaybeRefOrGetter<Element | null | undefined>,
): void {
  const { registerMessageId, reaches } = useLabelableContext();
  const source = Symbol();

  useRegisteredId(
    () => toValue(id),
    (getId) => registerMessageId(source, getId),
    element,
    reaches,
  );
}
