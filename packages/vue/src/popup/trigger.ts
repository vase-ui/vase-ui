import { computed, shallowRef, watch, type Ref } from 'vue';
import { addEventListener } from '../common/addEventListener';
import { useButton } from '../common/button';
import { useIsHydrated } from '../common/hydration';
import { mergeCleanups } from '../common/mergeCleanups';
import { ownerDocument } from '../common/owner';
import { platform } from '../common/platform';
import { activeElement } from '../common/shadowDom';
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
  // The server and the first render know the root of the setup. A server stops a sync watcher
  // only after the render, so the trigger stays in its root for the whole render. The trigger
  // moves at once when the root changes, such as when a handle gives it at the mount, so that
  // `open(id)` in the `onMounted` of a child of a root that takes the handle finds the trigger.
  watch(
    root,
    (current, _, onCleanup) => {
      if (current) onCleanup(current.addTrigger(entry));
    },
    { immediate: true, flush: 'sync' },
  );
}

/** The `click` of a press of a mouse, which a trigger with `pressStart` handled at `pointerdown`. */
export function isMouseClick(event: MouseEvent) {
  return event.detail !== 0 && interactionOf(event) === 'mouse';
}

/**
 * The `pointerdown` of a press that a screen reader gives. With a mouse pointer, it has no size, or
 * it is 1 by 1 pixel with no pressure and no pressed button, as Chrome gives for TalkBack,
 * VoiceOver and NVDA. On Android, TalkBack gives a pressed button, so only the pressure counts.
 * VoiceOver on iOS gives a touch of less than 1 by 1 pixel with no pressure.
 */
export function isVirtualPress(event: PointerEvent) {
  const { width, height, pressure } = event;
  if (event.pointerType === 'touch') return width < 1 && height < 1 && pressure === 0;
  if (event.pointerType !== 'mouse') return false;
  if (width === 0 && height === 0) return true;
  return (
    width === 1 && height === 1 && pressure === 0 && (platform.os.android || event.buttons === 0)
  );
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
  let focusAtPress: Element | null = null;
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
    if (!current) return undefined;
    const close = open.value && (options.closesAtPress?.(event) ?? true);
    return current.request(!close, 'trigger-press', event, options.element.value, interaction);
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

  /**
   * Gives `true` when the press asked to open the closed popup of this trigger, and no listener
   * cancelled the open. A parent that holds `open` applies the open after this event.
   */
  function onPointerdown(event: PointerEvent) {
    pressed = false;
    press.value = null;
    focusAtPress = activeElement(ownerDocument(event.currentTarget as Element));
    // The `click` of a press of a screen reader opens the popup, as for a key.
    if (!options.pressStart?.() || event.pointerType !== 'mouse' || event.button !== 0) {
      return false;
    }
    if (isVirtualPress(event)) return false;
    if (button.disabled.value) return false;
    pressed = true;
    const opens = !open.value;
    const details = toggle(event);
    press.value = event.currentTarget as Element;
    return opens && !!details && !details.isCanceled;
  }

  /**
   * A press that opens, closes or keeps open the popup at `pointerdown` can move the focus before
   * its `mousedown`: into the popup, or to the trigger or `finalFocus`. A change that the parent
   * applies is also in place at the `mousedown`. The `mousedown` would then give the focus to the
   * button, and in WebKit on macOS to `<body>` (test/measurements/select.test.ts). A press that
   * moves no focus keeps the `mousedown` of a button.
   */
  function onMousedown(event: MouseEvent) {
    const focused = activeElement(ownerDocument(event.currentTarget as Element));
    if (focused !== focusAtPress) event.preventDefault();
  }

  function onKeydown(event: KeyboardEvent) {
    pressed = false;
    keyed = event.key === 'Enter' || event.key === ' ';
  }

  return { button, active, open, onClick, onPointerdown, onMousedown, onKeydown };
}
