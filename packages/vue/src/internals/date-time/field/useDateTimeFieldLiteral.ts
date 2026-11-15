import { toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { useDateTimeFieldContext } from './DateTimeFieldContext';

/**
 * The `ref` setter of a part that shows a separator, an era or a time zone name. The root compares
 * the elements of these parts with its layout after the hydration. A literal part calls it in
 * `setup`, inside a root that called `useDateTimeFieldRoot`.
 * @param index The place of the part in the layout.
 */
export function useDateTimeFieldLiteral(
  index: MaybeRefOrGetter<number>,
): (element: unknown) => void {
  const context = useDateTimeFieldContext();
  let ownElement: HTMLElement | null = null;

  return (element) => {
    const next = element as HTMLElement | null;
    // Vue calls a function ref again on each patch, with the same element.
    if (next === ownElement) {
      return;
    }
    if (ownElement) {
      context.unregisterLiteral(ownElement);
    }
    if (next) {
      context.registerLiteral(next, toValue(index));
    }
    ownElement = next;
  };
}
