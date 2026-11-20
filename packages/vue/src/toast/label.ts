import { onBeforeUpdate, shallowRef, useSlots } from 'vue';
import type { ToastLabel } from './types';

/** `0` is content. An empty text, `null`, `undefined` and a Boolean are none. */
export function hasContent(label: ToastLabel | null | undefined | boolean): boolean {
  return label != null && typeof label !== 'boolean' && label !== '';
}

/**
 * The part has a default slot or an `element` slot. Slots are not reactive, so the part reads them
 * again before each render.
 */
export function useHasSlot() {
  const slots = useSlots();
  const read = () => !!slots.default || !!slots.element;
  const has = shallowRef(read());
  onBeforeUpdate(() => {
    has.value = read();
  });
  return has;
}
