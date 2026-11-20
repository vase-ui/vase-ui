import { computed, onMounted, shallowRef, watch, type Ref } from 'vue';
import { addEventListener } from '../common/addEventListener';
import { useButton } from '../common/button';
import { useIsHydrated } from '../common/hydration';
import { mergeCleanups } from '../common/mergeCleanups';
import { ownerDocument } from '../common/owner';
import {
  interactionOf,
  rootOfHandle,
  type InteractionType,
  type PopupHandle,
  type PopupRoot,
  type PopupTrigger,
} from './root';

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

/** The `click` of a press of a mouse, which a trigger with `pressStart` handled at `pointerdown`. */
export function isMouseClick(event: MouseEvent) {
  return event.detail !== 0 && interactionOf(event) === 'mouse';
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
     * A press of the main mouse button opens or closes the popup at `pointerdown`, and the `click`
     * of that press does nothing. A touch, a pen, a key and a script act at `click`.
     */
    pressStart?: () => boolean;
    /**
     * The trigger knows a key click by the Enter or Space `keydown` before it, and not by `detail`.
     * The `click` of a native label has `detail` 0 in WebKit only
     * (test/measurements/select.test.ts), so each other click is a pointer click.
     */
    keyClickByKeydown?: boolean;
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

  let pressed = false;
  let keyed = false;
  // The trigger of a press that acted at `pointerdown`, until the release. The `click` of the press
  // comes to the trigger only after a release on it. After a release at another place, the next
  // `click`, such as that of a native label, is no click of the press.
  const press = shallowRef<Element | null>(null);
  watch(
    press,
    (trigger, _, onCleanup) => {
      if (!trigger) return;
      const release = (event: PointerEvent) => {
        press.value = null;
        pressed = event.type === 'pointerup' && trigger.contains(event.composedPath()[0] as Node);
      };
      const doc = ownerDocument(trigger);
      onCleanup(
        mergeCleanups(
          addEventListener(doc, 'pointerup', release, true),
          addEventListener(doc, 'pointercancel', release, true),
        ),
      );
    },
    { flush: 'sync' },
  );

  function toggle(event: MouseEvent, interaction?: InteractionType) {
    const current = root();
    if (!current) return;
    const close = open.value && (options.closesAtPress?.(event) ?? true);
    current.request(!close, 'trigger-press', event, options.element.value, interaction);
  }

  function onClick(event: MouseEvent) {
    const wasPressed = pressed;
    const wasKeyed = keyed;
    pressed = false;
    keyed = false;
    // A key and a script give a click with no press.
    if (wasPressed && event.detail !== 0) return;
    if (!options.keyClickByKeydown) {
      toggle(event);
      return;
    }
    const interaction = interactionOf(event);
    toggle(event, wasKeyed ? 'keyboard' : interaction === 'keyboard' ? '' : interaction);
  }

  function onPointerdown(event: PointerEvent) {
    pressed = false;
    press.value = null;
    if (!options.pressStart?.() || event.pointerType !== 'mouse' || event.button !== 0) return;
    if (button.disabled.value) return;
    pressed = true;
    toggle(event);
    press.value = event.currentTarget as Element;
  }

  function onKeydown(event: KeyboardEvent) {
    pressed = false;
    keyed = event.key === 'Enter' || event.key === ' ';
  }

  return { button, active, open, onClick, onPointerdown, onKeydown };
}
