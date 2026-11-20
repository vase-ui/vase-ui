import {
  computed,
  inject,
  provide,
  shallowReactive,
  shallowRef,
  watch,
  type InjectionKey,
} from 'vue';
import { injectPopoverRoot } from '../../popover/root';
import type { FocusTarget } from '../../popup/focus';
import { byDocumentOrder } from '../element';
import type { PickerForPart } from './root';

type FocusTargetOf = () => HTMLElement | null | undefined;

/** What a picker `Popup` gives to the parts in it. */
interface PopupForPart {
  /** Adds an element that takes the focus when the popup opens. Returns the function that removes it. */
  addFocusTarget(target: FocusTargetOf): () => void;
  /** The popup element, while it is mounted. */
  element(): HTMLElement | null;
}

const popupKey: InjectionKey<PopupForPart> = Symbol('picker popup');

/**
 * The first focus of a picker `Popup`: the first of its targets in the document. The value of
 * `initialFocus` replaces it, also `false`. `true`, `null`, and a function that gives one of them
 * ask for the target of the picker.
 */
export function usePopupFocusTargets(
  initialFocus: () => FocusTarget | undefined,
  element: () => HTMLElement | null,
): FocusTarget {
  const targets = shallowReactive(new Set<FocusTargetOf>());
  provide(popupKey, {
    addFocusTarget(target) {
      targets.add(target);
      return () => targets.delete(target);
    },
    element,
  });
  const first = () =>
    [...targets]
      .map((target) => target())
      .filter((element): element is HTMLElement => !!element)
      .sort(byDocumentOrder)[0] ?? true;
  const resolve = (target: HTMLElement | boolean | null | undefined | void) =>
    target === true || target === null ? first() : target;
  return (interaction) => {
    const given = initialFocus();
    if (typeof given === 'function') return resolve(given(interaction));
    return given === undefined ? first() : resolve(given);
  };
}

/** Adds a focus target to the nearest picker `Popup`. A part that is in no `Popup` adds none. */
export function addPopupFocusTarget(target: FocusTargetOf): () => void {
  return inject(popupKey, null)?.addFocusTarget(target) ?? (() => {});
}

/** The element of the nearest picker `Popup`, while it is mounted. */
export function injectPopupElement(): () => HTMLElement | null {
  const popup = inject(popupKey, null);
  return () => popup?.element() ?? null;
}

/** The open and the close of the popup of a picker, for a part in a picker root. */
export function usePickerPopup(part: string) {
  const { root } = injectPopoverRoot(part);
  return {
    get open() {
      return root.open;
    },
    /** Opens the popup for a key, as a press of `trigger` does. */
    openByKey(event: KeyboardEvent, trigger: Element | undefined) {
      root.request(true, 'trigger-press', event, trigger ?? null);
    },
    /** Closes the popup after a pick. */
    closeAfterPick(event: Event) {
      root.request(false, 'imperative-action', event);
    },
    /** Closes the popup after an Escape that a control of the popup took. */
    cancel(event: KeyboardEvent) {
      root.request(false, 'escape-key', event);
    },
  };
}

/**
 * What the triggers of the pickers share: the element in the root, and the props of
 * `Popover.Trigger` that a picker owns. The part binds `setTrigger` as the ref of its trigger.
 */
export function usePickerTrigger(picker: PickerForPart<unknown>, disabled: () => boolean) {
  const { setPart, element } = usePickerPart();
  watch(
    element,
    (el, _, onCleanup) => {
      if (el) onCleanup(picker.addTrigger(el));
    },
    { flush: 'post' },
  );
  return {
    setTrigger: setPart,
    element,
    /**
     * A disabled or read-only picker disables the trigger. The trigger belongs to the picker root:
     * no handle, no payload, no open on hover.
     */
    owned: () => ({
      disabled: disabled() || picker.disabled || picker.readonly,
      handle: undefined,
      payload: undefined,
      openOnHover: undefined,
      delay: undefined,
      closeDelay: undefined,
    }),
  };
}

/** The element of the part of another family that a wrapper renders. Bind `setPart` as its ref. */
export function usePickerPart() {
  const part = shallowRef<{ element: HTMLElement | null } | null>(null);
  return {
    setPart: (value: unknown) => {
      part.value = value as { element: HTMLElement | null } | null;
    },
    element: computed(() => part.value?.element ?? null),
  };
}
