import { computed, provide, shallowRef, watch } from 'vue';
import { addEventListener } from '../../../common/addEventListener';
import { mergeCleanups } from '../../../common/mergeCleanups';
import { ownerVisuallyHidden } from '../../../internals/constants';
import { createChangeEventDetails } from '../../../internals/createVaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import { createFocusGuardElement } from '../focus/createFocusGuardElement';
import { useElementSiblings } from '../focus/useElementSiblings';
import { useElementId } from '../useElementId';
import type { ElementSiblings } from '../focus/useElementSiblings';
import {
  disableFocusInside,
  enableFocusInside,
  getNextTabbable,
  getPreviousTabbable,
  getTabbableNearElement,
  isOutsideEvent,
} from '../focus/tabbable';
import type { FocusableElement } from '../focus/tabbable';
import { PortalContext } from './PopupPortalContext';
import type { FocusManagerState } from './PopupPortalContext';
import type { Ref } from 'vue';
import type { PopupPortalProps } from './PopupPortal.vue';
import PopupPortalAnchor from './PopupPortalAnchor.vue';

export function usePortalFocus(
  element: Readonly<Ref<HTMLElement | null>>,
  props: PopupPortalProps,
  teleportStart: Readonly<Ref<Comment | Text | HTMLElement | null>>,
) {
const focusManagerState = shallowRef<FocusManagerState | null>(null);
const modal = computed(() => focusManagerState.value?.modal);
const open = computed(() => focusManagerState.value?.open);

// When the focus moves from the portal to an element outside it, the Tab key must skip the
// elements of the portal. It must enter the popup only through a guard. The flag records that the
// portal made the elements untabbable.
let focusInsideDisabled = false;

function handleFocus(event: FocusEvent) {
  const portalNode = element.value;
  if (portalNode && event.relatedTarget && isOutsideEvent(event, portalNode)) {
    if (event.type === 'focusin') {
      if (focusInsideDisabled) {
        enableFocusInside(portalNode);
        focusInsideDisabled = false;
      }
    } else {
      disableFocusInside(portalNode);
      focusInsideDisabled = true;
    }
  }
}

// The capture phase runs these listeners before a listener of the focus manager. A Vue listener
// here would get each focus in the popup first. Vue would then skip the Vue listener of a target
// that mounted in the millisecond of the focus.
watch(
  [element, modal, () => props.disabled],
  ([portalNode, isModal, inPlace], _previous, onCleanup) => {
    if (!portalNode || isModal || inPlace) {
      return;
    }
    onCleanup(
      mergeCleanups(
        addEventListener(portalNode, 'focusin', handleFocus, true),
        addEventListener(portalNode, 'focusout', handleFocus, true),
      ),
    );
  },
  { flush: 'post' },
);

// The focus manager moves the focus after it opens the popup. The elements in the portal must be
// tabbable again before that.
watch(
  [open, element],
  ([isOpen, portalNode]) => {
    if (!portalNode || isOpen !== true || !focusInsideDisabled) {
      return;
    }
    enableFocusInside(portalNode);
    focusInsideDisabled = false;
  },
  { flush: 'post' },
);

const shouldRenderOwner = computed(() => {
  const focusManager = focusManagerState.value;
  return focusManager !== null && !focusManager.modal && focusManager.open;
});

// A popup with a next focusable element has guards beside its trigger. A second pair of guards at
// the place of the portal would give the popup a second place in the tab order.
const shouldRenderGuards = computed(
  () => shouldRenderOwner.value && !focusManagerState.value?.hasNextFocusableElement,
);

// The `id` attribute and the `#render` slot can replace the generated id, and the owner element
// names the id that the DOM has.
const nodeId = useElementId(element);

interface PlaceNodes {
  owner: HTMLSpanElement;
  before: HTMLSpanElement;
  after: HTMLSpanElement;
  withGuards: ElementSiblings;
  ownerOnly: ElementSiblings;
}

let placeNodes: PlaceNodes | null = null;

function createPlaceNodes(document: Document): PlaceNodes {
  const owner = document.createElement('span');
  Object.assign(owner.style, ownerVisuallyHidden);
  const before = createFocusGuardElement(document);
  const after = createFocusGuardElement(document);
  before.setAttribute('data-type', 'outside');
  after.setAttribute('data-type', 'outside');
  before.addEventListener('focusin', handleBeforeGuardFocusin);
  after.addEventListener('focusin', handleAfterGuardFocusin);
  return {
    owner,
    before,
    after,
    withGuards: { before: [before, owner], after: [after] },
    ownerOnly: { before: [owner] },
  };
}

const placeSiblings = computed<ElementSiblings | null>(() => {
  const start = teleportStart.value;
  if (!start || !shouldRenderOwner.value) {
    return null;
  }
  placeNodes ??= createPlaceNodes(start.ownerDocument);
  return shouldRenderGuards.value ? placeNodes.withGuards : placeNodes.ownerOnly;
});

useElementSiblings(teleportStart, placeSiblings);

// `placeSiblings` is a source because it makes the owner element.
watch(
  [placeSiblings, () => props.portalOwnerRole, nodeId],
  ([, role, id]) => {
    if (!placeNodes) {
      return;
    }
    setOrRemoveAttribute(placeNodes.owner, 'role', role);
    setOrRemoveAttribute(placeNodes.owner, 'aria-owns', id || undefined);
  },
  { flush: 'post' },
);

function setOrRemoveAttribute(target: Element, name: string, value: string | undefined) {
  if (value === undefined) {
    target.removeAttribute(name);
  } else {
    target.setAttribute(name, value);
  }
}

const beforeOutsideRef = computed(() =>
  placeSiblings.value === placeNodes?.withGuards ? placeNodes.before : null,
);
const afterOutsideRef = computed(() =>
  placeSiblings.value === placeNodes?.withGuards ? placeNodes.after : null,
);
const beforeInsideRef = shallowRef<HTMLSpanElement | null>(null);
const afterInsideRef = shallowRef<HTMLSpanElement | null>(null);

provide(PortalContext, {
  portalNode: element,
  inPlace: computed(() => !!props.disabled),
  setFocusManagerState(nextState) {
    focusManagerState.value = nextState;
  },
  beforeInsideRef,
  afterInsideRef,
  beforeOutsideRef,
  afterOutsideRef,
});

function isPlaceGuard(candidate: Element) {
  return candidate === placeNodes?.before || candidate === placeNodes?.after;
}

function focusNearPlaceGuard(
  guard: HTMLSpanElement | undefined,
  direction: 1 | -1,
  domReference: Element | null | undefined,
) {
  const target = guard ? getTabbableNearElement(guard, direction, isPlaceGuard) : null;
  (target && !isPlaceGuard(target)
    ? target
    : (domReference as FocusableElement | null | undefined)
  )?.focus();
}

// When `KeepAlive` holds only the popup, its inside guards are out of the document while these
// outside guards stay. Each outside guard then skips the popup. The search starts at the other
// guard so the two guards do not focus each other.
function handleBeforeGuardFocusin(event: FocusEvent) {
  const focusManager = focusManagerState.value;
  if (isOutsideEvent(event, element.value ?? undefined)) {
    const insideGuard = beforeInsideRef.value;
    if (insideGuard?.isConnected) {
      insideGuard.focus();
      return;
    }

    focusNearPlaceGuard(placeNodes?.after, 1, focusManager?.domReference);
    if (focusManager?.closeOnFocusOut) {
      focusManager.onOpenChange(false, createChangeEventDetails(REASONS.focusOut, event));
    }
    return;
  }

  getPreviousTabbable(focusManager?.domReference ?? null)?.focus();
}

function handleAfterGuardFocusin(event: FocusEvent) {
  const focusManager = focusManagerState.value;
  if (isOutsideEvent(event, element.value ?? undefined)) {
    const insideGuard = afterInsideRef.value;
    if (insideGuard?.isConnected) {
      insideGuard.focus();
      return;
    }

    focusNearPlaceGuard(placeNodes?.before, -1, focusManager?.domReference);
    return;
  }

  getNextTabbable(focusManager?.domReference ?? null)?.focus();
  if (focusManager?.closeOnFocusOut) {
    focusManager.onOpenChange(false, createChangeEventDetails(REASONS.focusOut, event));
  }
}


  return PopupPortalAnchor;
}
