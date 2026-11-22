import { computed, onBeforeUpdate, shallowRef, useSlots, watch, type Ref } from 'vue';
import type { ToastLabel } from './types';

/** `0` is content. An empty text, `null`, `undefined` and a Boolean are none. */
export function hasContent(label: ToastLabel | null | undefined | boolean): boolean {
  return label != null && typeof label !== 'boolean' && label !== '';
}

/**
 * The part has a default slot or an `element` slot. The slots of a virtual DOM component are not
 * reactive, so the part reads them again before each render.
 */
export function useHasSlot() {
  const slots = useSlots();
  const renders = shallowRef(0);
  onBeforeUpdate(() => {
    renders.value += 1;
  });
  return computed(() => {
    void renders.value;
    return !!slots.default || !!slots.element;
  });
}

/**
 * The element is in the document and has text or an element child. A part does not know the content
 * of an element of its `element` slot before the render, and a component in the slot can change that
 * content with no render of the part.
 */
export function useHasContent(element: Readonly<Ref<HTMLElement | null>>) {
  const filled = shallowRef(false);
  watch(
    element,
    (el, _, onCleanup) => {
      const read = () => {
        filled.value = !!el && (el.childElementCount > 0 || !!el.textContent?.trim());
      };
      read();
      if (!el) return;
      const observer = new MutationObserver(read);
      observer.observe(el, { childList: true, characterData: true, subtree: true });
      onCleanup(() => observer.disconnect());
    },
    { immediate: true, flush: 'post' },
  );
  return filled;
}
