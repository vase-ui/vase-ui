import { toRaw, watch } from 'vue';
import type { Ref } from 'vue';
import { ownerDocument } from '../../common/owner';
import { activeElement, contains } from '../../common/shadowDom';
import { REASONS } from '../../internals/reasons';
import type { MenuParent, MenuRootChangeEventReason } from '../root/MenuRoot.vue';
import type { MenuStore } from '../store/MenuStore';
import type { MenuFilterParentHandoff } from './MenuFilterContext';
import { isPlainMainOrientationKey } from './isPlainMainOrientationKey';
import { NESTED_FOCUSIN, NESTED_KEYDOWN, useNestedPopupEventSender } from './nestedPopupEvents';

// The keys that `stopParentNavigationKey` stopped. The `cancelBubble` of such a key does not tell
// whether a later listener of the popup handled it too.
const stoppedParentNavigationKeys = new WeakSet<Event>();

function isStopped(event: Event) {
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- `cancelBubble` is the only read that tells that a listener stopped the event.
  return event.cancelBubble;
}

/**
 * The handoff between a popup and a filterable parent. A plain submenu returns the focus and the
 * highlight to the input of the parent when it closes: the parent keeps real focus on its input,
 * so its trigger never blurs, and its return focus waits for the exit animation of this popup.
 * A popup of any kind also gives its focus and its keys to the popups above through the popup
 * tree, because Vue sends the events of a teleported popup only to its own DOM ancestors.
 *
 * Call it in `setup` of the popup.
 */
export function useVirtualFocusParentHandoff(
  store: MenuStore<unknown>,
  parent: MenuParent,
  open: Readonly<Ref<boolean>>,
  virtualFocus: boolean,
): MenuFilterParentHandoff {
  const parentStore = parent.type === 'menu' ? parent.store : null;
  const parentVirtualFocusRef = parentStore?.context.virtualFocusRef;
  const sendToParents = useNestedPopupEventSender();

  function returnToParent(trigger: Element | null, reason: MenuRootChangeEventReason | null) {
    const focusOwner = parentVirtualFocusRef?.value;
    if (virtualFocus || store.select('open') || !parentStore?.select('open') || !focusOwner) {
      return;
    }

    if (contains(store.context.popupRef.value, activeElement(ownerDocument(focusOwner)))) {
      focusOwner.focus({ preventScroll: true });
    }

    if (
      (reason === REASONS.listNavigation || reason === REASONS.escapeKey) &&
      toRaw(parentStore.state).activeIndex == null
    ) {
      // The closing key is gone by this microtask, so there is no event to report it with.
      parentStore.highlightItem(trigger, REASONS.none);
    }
  }

  watch(open, (isOpen) => {
    if (isOpen) {
      return;
    }
    // The unmount clears the trigger before the microtask, so read it now.
    const trigger = toRaw(store.state).activeTriggerElement;
    const reason = store.select('lastOpenChangeReason');
    queueMicrotask(() => returnToParent(trigger, reason));
  });

  // Real focus entering this submenu is when a plain parent's trigger would blur: the parent has
  // no active item until a keyboard close hands the cursor back to the trigger.
  function handleFocus(event: FocusEvent) {
    if (parentStore) {
      sendToParents(NESTED_FOCUSIN, event);
    }
    if (!virtualFocus && parentVirtualFocusRef && toRaw(parentStore?.state)?.activeIndex != null) {
      parentStore?.setActiveIndex(null, REASONS.none);
    }
  }

  // The list of a filterable parent moves the highlight of the parent for a key of the main axis
  // that comes from this popup. The list navigation of the parent would move it from an index that
  // is stale while this popup has the focus. `useListNavigation` of this popup gives the key to
  // the list navigation of the parent only while the key still bubbles, so this stop comes first.
  function stopParentNavigationKey(event: KeyboardEvent) {
    if (
      parentVirtualFocusRef &&
      isPlainMainOrientationKey(event, parentStore?.context.orientation)
    ) {
      stoppedParentNavigationKeys.add(event);
      event.stopPropagation();
    }
  }

  // The list of the parent gets the key after each other listener of this popup. A key that such
  // a listener handled stays with that listener, as a stopped key stays below a popup in React.
  function sendKeyToParentList(event: KeyboardEvent) {
    if (!parentVirtualFocusRef) {
      return;
    }
    const handled = stoppedParentNavigationKeys.has(event)
      ? event.defaultPrevented
      : isStopped(event);
    if (!handled) {
      sendToParents(NESTED_KEYDOWN, event);
    }
  }

  return { parentVirtualFocusRef, handleFocus, stopParentNavigationKey, sendKeyToParentList };
}
