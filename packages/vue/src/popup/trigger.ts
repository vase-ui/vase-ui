import { computed, onMounted, watch, type Ref } from 'vue';
import { useButton } from '../common/button';
import { useIsHydrated } from '../common/hydration';
import { rootOfHandle, type PopupHandle, type PopupRoot, type PopupTrigger } from './root';

/**
 * The root of the handle of a trigger. The trigger reads it after its own mount, so its first render
 * is that of the server HTML, where no root has a handle. Vue keeps an attribute of the server HTML
 * that the first client render changes (test/measurements/dialog.test.ts).
 */
export function useHandleRoot<Payload>(handle: () => PopupHandle<Payload> | undefined) {
  const mounted = useIsHydrated();
  return computed(() => {
    const given = handle();
    return given && mounted.value ? rootOfHandle(given) : null;
  });
}

/** Adds the trigger to its root, from its `setup` to its unmount. */
export function useTriggerEntry(root: () => PopupRoot | null, entry: PopupTrigger) {
  // The server and the first render know the root of the setup. A server stops an immediate
  // watcher after its first run, and its cleanup would remove the trigger. From the mount, the
  // watcher follows the root, which a handle can give after the mount.
  const removeInitial = root()?.addTrigger(entry);
  onMounted(() => {
    removeInitial?.();
    watch(
      root,
      (current, _, onCleanup) => {
        if (current) onCleanup(current.addTrigger(entry));
      },
      { immediate: true },
    );
  });
}

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
    /** The tag of the element before the mount, where the part knows it (a tag in `as`). */
    tag: () => string | undefined;
    /** A press closes the open popup of this trigger. */
    closesAtPress?: (event: MouseEvent) => boolean;
    /** The disabled trigger keeps the focus, with `aria-disabled`. */
    focusableWhenDisabled?: () => boolean;
    /**
     * A press of the main mouse button acts at `pointerdown`, and its `click` does nothing. A
     * touch, a pen, a key and a script act at `click`.
     */
    pressStart?: () => boolean;
  },
) {
  const button = useButton({
    element: options.element,
    disabled: options.disabled,
    focusableWhenDisabled: options.focusableWhenDisabled,
    type: 'button',
    tag: options.tag,
  });

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
  useTriggerEntry(root, entry);

  const active = computed(() => {
    const current = root();
    return !!current && current.activeTriggerId === options.id();
  });
  const open = computed(() => active.value && !!root()?.open);

  function toggle(event: MouseEvent) {
    const current = root();
    if (!current) return;
    if (open.value && (options.closesAtPress?.(event) ?? true)) {
      current.request(false, 'trigger-press', event, options.element.value);
    } else {
      current.request(true, 'trigger-press', event, options.element.value);
    }
  }

  let pressed = false;
  function onPointerdown(event: PointerEvent) {
    pressed = !!options.pressStart?.() && event.pointerType === 'mouse' && event.button === 0;
    if (pressed && !button.disabled.value) toggle(event);
  }

  function onClick(event: MouseEvent) {
    // A key and a script give a click with no press.
    if (pressed && event.detail !== 0) {
      pressed = false;
      return;
    }
    toggle(event);
  }

  return { button, active, open, onClick, onPointerdown };
}
