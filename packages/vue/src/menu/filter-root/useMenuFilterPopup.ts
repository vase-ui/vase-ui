import { onMounted, toValue, watch } from 'vue';
import type { HTMLAttributes, MaybeRefOrGetter } from 'vue';
import { isElement, isHTMLElement } from '@floating-ui/utils/dom';
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
 * Gives the popup of a filterable menu its attributes and its listeners: the input keeps the focus
 * while the pointer and the keys move over the popup. Call it in `setup`.
 *
 * @param orientation The orientation of the menu, as a value, a ref or a getter.
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
    const warnWithoutInput = () => {
      if (context.open.value && focusOwnerRef.value === null) {
        warn(
          'A filterable menu opened without a <Menu.Input>.',
          'Without the input, the menu has no field to filter with.',
          'Render the input inside <Menu.Popup>, or drop <Menu.FilterProvider> for a menu that does not filter.',
        );
      }
    };
    onMounted(warnWithoutInput);
    watch(context.open, warnWithoutInput, { flush: 'post' });
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

    // The composed path only contains this popup when the pointer is really over it, and a
    // closing popup must not re-capture focus during its exit transition.
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

      if (target === focusOwnerRef.value) {
        nestedFocus = null;
      } else if (
        isHTMLElement(target) &&
        !contains(event.currentTarget as Element, target) &&
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
        // A nested popup that is not teleported bubbles its keys to this popup, so keep the key
        // from the parent.
        event.stopPropagation();
      }
    },
  };
}
