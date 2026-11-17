<script lang="ts">
import type { HTMLAttributes, MaybeRefOrGetter } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../../internals/types';
import type { FloatingPortalContainer } from './useFloatingPortalNode';

export interface FloatingPortalState {}

/**
 * Puts the popup into a container, by default `<body>`, unless `inPlace` is true.
 * In a container, a parent with `overflow: hidden` does not clip the popup.
 * The popup keeps its place in the component tree.
 * @see https://floating-ui.com/docs/FloatingPortal
 */
export interface FloatingPortalProps
  extends
    VaseUIComponentProps<FloatingPortalState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * A parent element to render the portal element into.
   */
  container?: MaybeRefOrGetter<FloatingPortalContainer> | undefined;
  /**
   * The role for the hidden `aria-owns` owner element.
   */
  portalOwnerRole?: string | undefined;
  /**
   * Whether the portal element renders in the place of the part, with no `Teleport`.
   * Other portal parts pass attributes to this component.
   * The internal name keeps their `disabled` attributes separate from this mode.
   * @default false
   */
  inPlace?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed, provide, shallowRef, watch } from 'vue';
import type { Component } from 'vue';
import { addEventListener } from '../../../common/addEventListener';
import { EMPTY_OBJECT } from '../../../common/empty';
import { mergeCleanups } from '../../../common/mergeCleanups';
import { ownerVisuallyHidden } from '../../../internals/constants';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import type { HTMLProps } from '../../../internals/types';
import { createFocusGuardElement } from '../focus/createFocusGuardElement';
import { useElementSiblings } from '../focus/useElementSiblings';
import { useElementId } from '../useElementId';
import type { ElementSiblings } from '../focus/useElementSiblings';
import {
  disableFocusInside,
  enableFocusInside,
  getNextTabbable,
  getPreviousTabbable,
  isOutsideEvent,
} from '../focus/tabbable';
import FloatingPortalChildren from './FloatingPortalChildren.vue';
import { PortalContext } from './FloatingPortalContext';
import type { FocusManagerState } from './FloatingPortalContext';
import { useFloatingPortalNode } from './useFloatingPortalNode';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<FloatingPortalProps>(), { as: 'div', inPlace: false });

defineSlots<{
  default(props: { state: FloatingPortalState }): unknown;
  render(props: { props: HTMLProps; state: FloatingPortalState; children: Component }): unknown;
}>();

const state: FloatingPortalState = EMPTY_OBJECT;

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

const { element, elementProps, containerElement, isHeld } = useFloatingPortalNode({
  container: () => props.container,
  componentProps: props,
  children: true,
  inPlace: () => props.inPlace,
});

// The capture phase runs these listeners before a listener of the focus manager. A Vue listener
// here would get each focus in the popup first. Vue would then skip the Vue listener of a target
// that mounted in the millisecond of the focus.
watch(
  [element, modal, () => props.inPlace],
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
  return !props.inPlace && focusManager !== null && !focusManager.modal && focusManager.open;
});

// A popup with a next focusable element has guards beside its trigger. A second pair of guards at
// the place of the portal would give the popup a second place in the tab order.
const shouldRenderGuards = computed(
  () => shouldRenderOwner.value && !focusManagerState.value?.hasNextFocusableElement,
);

// The `id` attribute and the `#render` slot can replace the generated id, and the owner element
// names the id that the DOM has.
const nodeId = useElementId(element);

// Vue gives a ref of a `Teleport` the node that marks the place of the `Teleport`: a comment in a
// development build, and an empty text node in a production build. The guards and the owner
// element are not in the template, so the part has one root node in either form.
const teleportStart = shallowRef<Comment | Text | null>(null);

function setTeleportStart(node: unknown) {
  teleportStart.value = node as Comment | Text | null;
}

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
  inPlace: computed(() => props.inPlace),
  setFocusManagerState(nextState) {
    focusManagerState.value = nextState;
  },
  beforeInsideRef,
  afterInsideRef,
  beforeOutsideRef,
  afterOutsideRef,
});

function handleBeforeGuardFocusin(event: FocusEvent) {
  if (isOutsideEvent(event, element.value ?? undefined)) {
    beforeInsideRef.value?.focus();
    return;
  }

  getPreviousTabbable(focusManagerState.value?.domReference ?? null)?.focus();
}

function handleAfterGuardFocusin(event: FocusEvent) {
  if (isOutsideEvent(event, element.value ?? undefined)) {
    afterInsideRef.value?.focus();
    return;
  }

  const focusManager = focusManagerState.value;
  getNextTabbable(focusManager?.domReference ?? null)?.focus();
  if (focusManager?.closeOnFocusOut) {
    focusManager.onOpenChange(false, createChangeEventDetails(REASONS.focusOut, event));
  }
}

defineExpose({ element });
</script>

<template>
  <slot
    v-if="inPlace && $slots.render"
    name="render"
    :props="elementProps()"
    :state="state"
    :children="FloatingPortalChildren"
  />
  <component :is="as" v-else-if="inPlace" v-bind="elementProps()"
    ><slot :state="state"
  /></component>
  <Teleport
    v-else-if="containerElement"
    :ref="setTeleportStart"
    :to="containerElement"
    :disabled="isHeld"
  >
    <slot
      v-if="$slots.render"
      name="render"
      :props="elementProps()"
      :state="state"
      :children="FloatingPortalChildren"
    />
    <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
  </Teleport>
</template>
