import { toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { useLabelableContext } from './LabelableContext';
import { useRegisteredId } from './useRegisteredId';
import { useRenderedElementId } from './useRenderedElementId';

/**
 * A part that describes the control calls it in `setup`, such as a description or an error.
 * The control then has the `id` in its `aria-describedby`.
 * An absent `id` registers nothing.
 * A `#render` slot can give `element` another `id`, and the control then names that `id`.
 */
export function useRegisteredMessageId(
  id: MaybeRefOrGetter<string | undefined>,
  element?: MaybeRefOrGetter<Element | null | undefined>,
): void {
  const { registerMessageId } = useLabelableContext();
  const elementId = element === undefined ? undefined : useRenderedElementId(element);
  const source = Symbol();

  useRegisteredId(
    () => {
      const ownId = toValue(id);
      return ownId === undefined ? undefined : (elementId?.value ?? ownId);
    },
    (getId) => registerMessageId(source, getId),
  );
}
