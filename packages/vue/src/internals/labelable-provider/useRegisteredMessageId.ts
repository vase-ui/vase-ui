import { toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { useLabelableContext } from './LabelableContext';
import { useRegisteredId } from './useRegisteredId';

/**
 * A part that describes the control calls it in `setup`, such as a description or an error.
 * The control then names the part in its `aria-describedby`.
 * An absent `id` registers nothing. From the mount on, the control names the `id` that `element`
 * has now, and an element with an empty `id` registers nothing.
 */
export function useRegisteredMessageId(
  id: MaybeRefOrGetter<string | undefined>,
  element: MaybeRefOrGetter<Element | null | undefined>,
): void {
  const { registerMessageId } = useLabelableContext();

  useRegisteredId(() => toValue(id), registerMessageId, element);
}
