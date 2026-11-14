import { computed } from 'vue';
import {
  getNextTabbable,
  getPreviousTabbable,
  isOutsideEvent,
} from '../../utils/popups/focus/tabbable';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import { createElementSetter } from '../utils/createElementSetter';

/**
 * Gives the two inside focus guards of the viewport. In a positioner, the guards are siblings of
 * the viewport element. With no positioner, they are in the viewport element, around the element
 * that holds the content.
 *
 * Call it in `setup`.
 */
export function useNavigationMenuViewportGuards(inPositioner: boolean) {
  const {
    floatingRootStore,
    positionerElement,
    viewportElement,
    beforeInsideRef,
    afterInsideRef,
    beforeOutsideRef,
    afterOutsideRef,
  } = useNavigationMenuRootContext();

  const hasGuards = computed(() => inPositioner || floatingRootStore.value !== undefined);

  function handleBeforeInsideFocusin(event: FocusEvent) {
    const referenceElement = positionerElement.value || viewportElement.value;

    if (referenceElement && isOutsideEvent(event, referenceElement)) {
      getNextTabbable(referenceElement)?.focus();
    } else {
      beforeOutsideRef.value?.focus();
    }
  }

  function handleAfterInsideFocusin(event: FocusEvent) {
    const referenceElement = positionerElement.value || viewportElement.value;

    if (referenceElement && isOutsideEvent(event, referenceElement)) {
      getPreviousTabbable(referenceElement)?.focus();
    } else {
      afterOutsideRef.value?.focus();
    }
  }

  return {
    hasGuards,
    setBeforeInsideGuard: createElementSetter(beforeInsideRef),
    setAfterInsideGuard: createElementSetter(afterInsideRef),
    handleBeforeInsideFocusin,
    handleAfterInsideFocusin,
  };
}
