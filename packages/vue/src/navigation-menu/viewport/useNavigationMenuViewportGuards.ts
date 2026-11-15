import { computed, onScopeDispose, watch } from 'vue';
import type { Ref } from 'vue';
import { createFocusGuardElement } from '../../utils/popups/focus/createFocusGuardElement';
import {
  getNextTabbable,
  getPreviousTabbable,
  isOutsideEvent,
} from '../../utils/popups/focus/tabbable';
import { useElementSiblings } from '../../utils/popups/focus/useElementSiblings';
import type { ElementSiblings } from '../../utils/popups/focus/useElementSiblings';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import type { NavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import { createElementSetter } from '../../utils/popups/createElementSetter';

function createInsideGuardHandlers({
  positionerElement,
  viewportElement,
  beforeOutsideRef,
  afterOutsideRef,
}: NavigationMenuRootContext) {
  function handleBeforeInsideFocusin(event: FocusEvent) {
    const referenceElement = positionerElement.value ?? viewportElement.value;

    if (referenceElement && isOutsideEvent(event, referenceElement)) {
      getNextTabbable(referenceElement)?.focus();
    } else {
      beforeOutsideRef.value?.focus();
    }
  }

  function handleAfterInsideFocusin(event: FocusEvent) {
    const referenceElement = positionerElement.value ?? viewportElement.value;

    if (referenceElement && isOutsideEvent(event, referenceElement)) {
      getPreviousTabbable(referenceElement)?.focus();
    } else {
      afterOutsideRef.value?.focus();
    }
  }

  return { handleBeforeInsideFocusin, handleAfterInsideFocusin };
}

/**
 * Gives the two inside focus guards of a viewport with no positioner. They are in the viewport
 * element, around the element that holds the content, while the root has the store of an active
 * trigger (`hasGuards`).
 *
 * Call it in `setup`.
 */
export function useNavigationMenuViewportGuards() {
  const context = useNavigationMenuRootContext();

  return {
    hasGuards: computed(() => context.floatingRootStore.value !== undefined),
    setBeforeInsideGuard: createElementSetter(context.beforeInsideRef),
    setAfterInsideGuard: createElementSetter(context.afterInsideRef),
    ...createInsideGuardHandlers(context),
  };
}

/**
 * Keeps the two inside focus guards of a viewport in a positioner before and after its element.
 * The guards are not in the template, so the viewport has one root node.
 *
 * Call it in `setup`.
 */
export function useNavigationMenuViewportSiblingGuards(element: Readonly<Ref<HTMLElement | null>>) {
  const context = useNavigationMenuRootContext();
  const { beforeInsideRef, afterInsideRef } = context;
  const { handleBeforeInsideFocusin, handleAfterInsideFocusin } =
    createInsideGuardHandlers(context);

  function createGuards(document: Document) {
    const before = createFocusGuardElement(document);
    const after = createFocusGuardElement(document);
    before.addEventListener('focusin', handleBeforeInsideFocusin);
    after.addEventListener('focusin', handleAfterInsideFocusin);
    const siblings: ElementSiblings = { before: [before], after: [after] };
    return { before, after, siblings };
  }

  let guards: ReturnType<typeof createGuards> | null = null;

  const siblings = computed(() => {
    const target = element.value;
    if (!target) {
      return null;
    }
    guards ??= createGuards(target.ownerDocument);
    return guards.siblings;
  });

  useElementSiblings(element, siblings);

  // Another viewport of the root can write the refs before this viewport stops, so a viewport
  // clears a ref only while the ref holds its own guard.
  function releaseGuards() {
    if (beforeInsideRef.value === guards?.before) {
      beforeInsideRef.value = null;
    }
    if (afterInsideRef.value === guards?.after) {
      afterInsideRef.value = null;
    }
  }

  watch(
    siblings,
    (placed) => {
      if (placed && guards) {
        beforeInsideRef.value = guards.before;
        afterInsideRef.value = guards.after;
      } else {
        releaseGuards();
      }
    },
    { flush: 'post' },
  );

  onScopeDispose(releaseGuards);
}
