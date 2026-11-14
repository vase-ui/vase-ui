import { isElement, isHTMLElement } from '@floating-ui/utils/dom';
import { onMounted, toValue, watch } from 'vue';
import type { HTMLAttributes, MaybeRefOrGetter } from 'vue';
import { ownerDocument } from '../../common/owner';
import { activeElement, contains, getTarget } from '../../common/shadowDom';
import { warn } from '../../common/warn';
import { useFilterDropdownRootContext } from '../../filter-dropdown/root/FilterDropdownRootContext';
import { isRefocusingOwner, refocusOwner } from '../../filter-dropdown/utils/refocusOwner';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { isTypeableElement } from '../../utils/popups/element';
import { isCrossOrientationCloseKey } from '../../utils/popups/interactions/useListNavigation';
import type { MenuRootOrientation } from '../root/MenuRoot.vue';

/**
 * Returns the attributes and the listeners of the popup of a filterable menu. The listeners keep
 * the focus on the filter input while the user presses or hovers the popup.
 *
 * Call it in `setup`.
 */
export function useMenuFilterPopup(
  orientation: MaybeRefOrGetter<MenuRootOrientation>,
): HTMLAttributes {
  const context = useFilterDropdownRootContext();
  const direction = useDirection();
  const { focusOwnerRef } = context;

  // Focus that entered a nested popup by keyboard or click stays there while the
  // pointer crosses the parent popup. Returning to a submenu trigger restores focus to the
  // parent input. Focus that merely followed the pointer in follows it back out.
  let nestedFocus: Element | null = null;
  // A tap fires compatibility mouse events, which must not focus the input and raise the
  // on-screen keyboard.
  let pointerType = 'mouse';

  function trackPointerType(event: PointerEvent) {
    pointerType = event.pointerType || 'mouse';
  }

  if (process.env.NODE_ENV !== 'production') {
    const warnWhenInputIsAbsent = () => {
      if (context.open.value && focusOwnerRef.value === null) {
        warn(
          'A filterable menu opened without a <Menu.Input>.',
          'The focus then has no input to stay on, so the user cannot type a query.',
          'Render the input inside <Menu.Popup>, or remove <Menu.FilterProvider> for a menu that does not filter.',
        );
      }
    };
    onMounted(warnWhenInputIsAbsent);
    watch(context.open, warnWhenInputIsAbsent, { flush: 'post' });
  }

  function restoreInputFocus(event: MouseEvent, enteredTrigger: boolean) {
    const focusOwner = focusOwnerRef.value;
    const popup = event.currentTarget as HTMLElement;
    if (!context.open.value || !focusOwner) {
      return;
    }

    const activeEl = activeElement(ownerDocument(popup));
    if (activeEl === focusOwner || contains(popup, activeEl)) {
      return;
    }

    // An inline nested popup sends its events through this popup. The composed path only
    // contains this popup as the nearest one when the pointer is really over it, and a closing
    // popup must not re-capture focus during its exit transition.
    let submenuTrigger: HTMLElement | null = null;
    const nearestPopup = event.composedPath().find((node) => {
      if (!isHTMLElement(node)) {
        return false;
      }
      if (node.getAttribute('role') === 'dialog' || node.hasAttribute('data-rootownerid')) {
        return true;
      }
      if (node.hasAttribute('aria-haspopup')) {
        submenuTrigger = node;
      }
      return false;
    });
    if (nearestPopup !== popup) {
      return;
    }

    // A nested popup that took focus keeps it while the pointer moves over the parent popup.
    // Entering a submenu trigger returns focus to the parent's input.
    if (nestedFocus && !(enteredTrigger && submenuTrigger)) {
      return;
    }
    if (
      enteredTrigger &&
      submenuTrigger &&
      isElement(event.relatedTarget) &&
      contains(submenuTrigger, event.relatedTarget)
    ) {
      return;
    }
    refocusOwner(focusOwner);
  }

  return {
    // The input owns virtual focus.
    'aria-activedescendant': undefined,
    // Not valid on a dialog; the list's implicit orientation is already vertical.
    'aria-orientation': undefined,
    onMousedown(event: MouseEvent) {
      if (getTarget(event) === event.currentTarget) {
        // Keep focus on the virtual focus owner when the popup's own background is pressed.
        event.preventDefault();
      }
    },
    onPointerdown: trackPointerType,
    // `pointerover` precedes the compatibility `mouseover`, so a mouse entering right after a tap
    // is recognized before the handoff below.
    onPointerover: trackPointerType,
    onPointermove: trackPointerType,
    onMousemove(event: MouseEvent) {
      if (pointerType === 'mouse') {
        restoreInputFocus(event, false);
      }
    },
    onMouseover(event: MouseEvent) {
      if (pointerType === 'mouse' && nestedFocus) {
        restoreInputFocus(event, true);
      }
    },
    onFocusin(event: FocusEvent) {
      // `focusin` bubbles, so this also sees the owner itself being focused.
      const target = getTarget(event);

      // In React, a portalled nested popup sends its focus events through this popup, while its
      // elements sit outside this one in the DOM. A nested popup that `Teleport` moved sends
      // none, so no target is outside this popup.
      if (target === focusOwnerRef.value) {
        nestedFocus = null;
      } else if (
        isHTMLElement(target) &&
        !contains(event.currentTarget as HTMLElement, target) &&
        !isRefocusingOwner()
      ) {
        nestedFocus = target;
      }

      // Focus that lands on the popup itself, the focus manager's fallback target, moves on to
      // the input, which owns focus while the menu filters.
      if (context.open.value && target === event.currentTarget) {
        focusOwnerRef.value?.focus({ preventScroll: true });
      }
    },
    onKeydown(event: KeyboardEvent) {
      const target = getTarget(event);
      if (target === focusOwnerRef.value || isTypeableElement(target)) {
        return;
      }

      if (
        isCrossOrientationCloseKey(
          event.key,
          toValue(orientation),
          direction.value === 'rtl',
          false,
        )
      ) {
        focusOwnerRef.value?.focus({ preventScroll: true });
        // An inline nested popup sends its keys through this popup, so keep the key from the
        // parent.
        event.stopPropagation();
      }
    },
  };
}
