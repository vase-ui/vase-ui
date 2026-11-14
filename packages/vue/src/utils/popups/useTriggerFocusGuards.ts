import { computed, nextTick, onScopeDispose, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, ShallowRef } from 'vue';
import { contains } from '../../common/shadowDom';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { VaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { createAttribute } from './createAttribute';
import { createFocusGuardElement } from './focus/createFocusGuardElement';
import { getTabbableNearElement, isOutsideEvent } from './focus/tabbable';
import { useElementSiblings } from './focus/useElementSiblings';
import type { ElementSiblings } from './focus/useElementSiblings';

// The guards that a portal renders around its place in the document have `data-type="outside"`.
function isPortalGuard(element: Element) {
  return (
    element.hasAttribute(createAttribute('focus-guard')) &&
    element.getAttribute('data-type') === 'outside'
  );
}

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
    readonly triggerFocusTargetRef: ShallowRef<HTMLElement | null>;
  };
}

/**
 * Keeps a focus guard before and after the element of a popup trigger while `enabled` is `true`.
 * A guard that gets the focus closes the popup and moves the focus to the tabbable element on its
 * side. A focus that comes from outside the popup onto the guard after the trigger goes into the
 * popup.
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
  ) {
    const guard = event.currentTarget as HTMLElement;
    toValue(store).setOpen(false, createChangeEventDetails(REASONS.focusOut, event, guard));
    // The close can change the tab order. The search below reads the DOM after the update.
    await nextTick();
    // A popup that did not close keeps its guards, and a guard of its portal sends the focus back
    // into the popup. The search leaves out the guards and the content of the popup. It starts at
    // the trigger, also when the `tabindex` of the trigger is -1, so the trigger keeps the focus
    // when no other element is tabbable.
    getTabbableNearElement(
      toValue(triggerElement),
      direction,
      (element) =>
        contains(positionerElement, element) ||
        element === guards?.before ||
        element === guards?.after ||
        isPortalGuard(element),
    )?.focus();
  }

  function handlePreFocusGuardFocus(event: FocusEvent) {
    void closeAndFocus(event, -1, toValue(store).select('positionerElement'));
  }

  function handleFocusTargetFocus(event: FocusEvent) {
    const current = toValue(store);
    const positionerElement = current.select('positionerElement');
    if (positionerElement && isOutsideEvent(event, positionerElement)) {
      current.context.beforeContentFocusGuardRef.value?.focus();
    } else {
      void closeAndFocus(event, 1, positionerElement);
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
