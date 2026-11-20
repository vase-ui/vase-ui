import { computed, onUnmounted, watch, type Ref } from 'vue';
import { useButton } from '../button/button';
import type { PopupRoot } from './root';

/**
 * A trigger of a popup: a button that registers with its root while it is mounted, and that
 * opens, closes, or moves the popup to itself at a press.
 */
export function usePopupTrigger(
  root: () => PopupRoot | null,
  options: {
    element: Readonly<Ref<HTMLElement | null>>;
    id: () => string;
    payload: () => unknown;
    disabled: () => boolean;
    /** A press closes the open popup of this trigger. */
    closesAtPress?: (event: MouseEvent) => boolean;
  },
) {
  const button = useButton({ element: options.element, disabled: options.disabled, type: 'button' });

  const entry = {
    get id() {
      return options.id();
    },
    get element() {
      return options.element.value;
    },
    get payload() {
      return options.payload();
    },
    get disabled() {
      return button.disabled.value;
    },
  };
  let unregister: (() => void) | undefined;
  watch(
    root,
    (current) => {
      unregister?.();
      unregister = current?.addTrigger(entry);
    },
    { immediate: true },
  );
  // Nuxt removes the call of `onUnmounted` from its server build, with its arguments.
  const stop = () => unregister?.();
  onUnmounted(stop);

  const active = computed(() => {
    const current = root();
    return !!current && current.activeTriggerId === options.id();
  });
  const open = computed(() => active.value && !!root()?.open);

  function onClick(event: MouseEvent) {
    const current = root();
    if (!current) return;
    if (open.value && (options.closesAtPress?.(event) ?? true)) {
      current.request(false, 'trigger-press', event, options.element.value);
    } else {
      current.request(true, 'trigger-press', event, options.element.value);
    }
  }

  return { button, active, open, onClick };
}
