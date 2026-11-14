import { computed, nextTick, onScopeDispose, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, ShallowRef } from 'vue';
import { contains } from '../../common/shadowDom';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { VaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { createFocusGuardElement } from './focus/createFocusGuardElement';
import { getTabbableNearElement, isOutsideEvent } from './focus/tabbable';
import { useElementSiblings } from './focus/useElementSiblings';
import type { ElementSiblings } from './focus/useElementSiblings';

/**
 * The part of a popup store that the focus guards of a trigger use. The stores of Popover and Menu
 * have it.
 */
export interface TriggerFocusGuardStore {
  setOpen(open: boolean, eventDetails: VaseUIChangeEventDetails<typeof REASONS.focusOut>): void;
  select(key: 'positionerElement'): HTMLElement | null;
  context: {
    /**
     * The focus manager gets it through `getInsideElements`. A blur of the trigger onto this guard
     * then does not close the popup before the handler of the guard runs.
     */
    readonly beforeTriggerFocusGuardRef: ShallowRef<HTMLElement | null>;
    readonly beforeContentFocusGuardRef: ShallowRef<HTMLElement | null>;
    readonly afterContentFocusGuardRef: ShallowRef<HTMLElement | null>;
    readonly triggerFocusTargetRef: ShallowRef<HTMLElement | null>;
  };
}

/**
 * Keeps a focus guard before and after the element of a popup trigger while `enabled` is `true`.
 * The guards give an open popup one place in the tab order, right after its trigger.
 *
 * A focus that leaves the trigger backward, or the popup forward, goes onto a guard. The guard
 * closes the popup and moves the focus to the tabbable element on its side.
 *
 * The guard before the trigger also gets the focus from any other element. It asks for the close,
 * and it focuses the trigger when the popup stays open.
 *
 * The guard after the trigger sends a focus from the trigger, or from no element, to the start of
 * the popup. It sends a focus from another element outside the popup to the end of the popup. It
 * asks for no close.
 *
 * The guards are not in the template, so the trigger keeps one root node.
 */
export function useTriggerFocusGuards(
  store: MaybeRefOrGetter<TriggerFocusGuardStore>,
  triggerElement: MaybeRefOrGetter<HTMLElement | null>,
  enabled: MaybeRefOrGetter<boolean>,
): void {
  async function closeAndFocus(
    event: FocusEvent,
    direction: 1 | -1,
    positionerElement: HTMLElement | null,
    entersTrigger: boolean,
  ) {
    const guard = event.currentTarget as HTMLElement;
    toValue(store).setOpen(false, createChangeEventDetails(REASONS.focusOut, event, guard));
    // The close can change the tab order. The code below reads the DOM after the update.
    await nextTick();
    const trigger = toValue(triggerElement);
    // The guards of the trigger follow the `open` state. A guard that is still in the document thus
    // shows that the popup stayed open. A focus that enters from outside then goes to the trigger,
    // which comes right before the popup in the tab order.
    if (entersTrigger && guard.isConnected) {
      trigger?.focus();
      return;
    }
    // The search skips the guards of the trigger and the content of the popup. It starts at the
    // trigger, also when the `tabindex` of the trigger is -1, so the trigger keeps the focus when no
    // other element is tabbable.
    getTabbableNearElement(
      trigger,
      direction,
      (element) =>
        contains(positionerElement, element) ||
        element === guards?.before ||
        element === guards?.after,
    )?.focus();
  }

  // The focus comes from the trigger when Shift+Tab leaves the trigger. A focus from any other
  // element, or from no element, enters from outside.
  function handlePreFocusGuardFocus(event: FocusEvent) {
    const entersTrigger = !contains(toValue(triggerElement), event.relatedTarget as Element | null);
    void closeAndFocus(event, -1, toValue(store).select('positionerElement'), entersTrigger);
  }

  // A focus with no origin has no direction. The Tab key from a trigger that a press did not focus
  // (WebKit, and Firefox on macOS) gives such a focus. It goes to the start of the popup, as a focus
  // from the trigger does and as in Base UI.
  function handleFocusTargetFocus(event: FocusEvent) {
    const current = toValue(store);
    const positionerElement = current.select('positionerElement');
    if (positionerElement && isOutsideEvent(event, positionerElement)) {
      const origin = event.relatedTarget as Element | null;
      const contentGuardRef =
        origin === null || contains(toValue(triggerElement), origin)
          ? current.context.beforeContentFocusGuardRef
          : current.context.afterContentFocusGuardRef;
      contentGuardRef.value?.focus();
    } else {
      void closeAndFocus(event, 1, positionerElement, false);
    }
  }

  let guards: { before: HTMLElement; after: HTMLElement; siblings: ElementSiblings } | null = null;

  const siblings = computed(() => {
    const trigger = toValue(triggerElement);
    if (!toValue(enabled) || !trigger) {
      return null;
    }
    if (guards?.before.ownerDocument !== trigger.ownerDocument) {
      const before = createFocusGuardElement(trigger.ownerDocument);
      const after = createFocusGuardElement(trigger.ownerDocument);
      before.addEventListener('focusin', handlePreFocusGuardFocus);
      after.addEventListener('focusin', handleFocusTargetFocus);
      guards = { before, after, siblings: { before: [before], after: [after] } };
    }
    return guards.siblings;
  });

  useElementSiblings(triggerElement, siblings);

  function clearRefs(target: TriggerFocusGuardStore) {
    if (target.context.beforeTriggerFocusGuardRef.value === guards?.before) {
      target.context.beforeTriggerFocusGuardRef.value = null;
    }
    if (target.context.triggerFocusTargetRef.value === guards?.after) {
      target.context.triggerFocusTargetRef.value = null;
    }
  }

  // Another trigger of the same store can write the refs in the same DOM update, so a trigger clears
  // only the guards that it wrote. A trigger with a handle changes its store when a root attaches.
  watch(
    [() => toValue(store), siblings],
    ([current, placed], [previous]) => {
      if (previous && previous !== current) {
        clearRefs(previous);
      }
      if (placed && guards) {
        current.context.beforeTriggerFocusGuardRef.value = guards.before;
        current.context.triggerFocusTargetRef.value = guards.after;
      } else {
        clearRefs(current);
      }
    },
    { flush: 'post' },
  );

  onScopeDispose(() => clearRefs(toValue(store)));
}
