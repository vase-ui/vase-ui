<script lang="ts">
import type { HTMLAttributes, MaybeRefOrGetter } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../../internals/types';
import type { FloatingPortalContainer } from './useFloatingPortalNode';

export interface FloatingPortalState {}

/**
 * Puts the popup into a container, by default `<body>`. A parent with `overflow: hidden` then
 * does not clip the popup. The popup keeps its place in the component tree.
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
}
</script>

<script setup lang="ts">
import { computed, onUpdated, provide, shallowRef, useTemplateRef, watch } from 'vue';
import { EMPTY_OBJECT } from '../../../common/empty';
import { ownerVisuallyHidden } from '../../../internals/constants';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../../internals/types';
import FocusGuard from '../focus/FocusGuard.vue';
import {
  disableFocusInside,
  enableFocusInside,
  getNextTabbable,
  getPreviousTabbable,
  isOutsideEvent,
} from '../focus/tabbable';
import { PortalContext } from './FloatingPortalContext';
import type { FocusManagerState } from './FloatingPortalContext';
import { useFloatingPortalNode } from './useFloatingPortalNode';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<FloatingPortalProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: FloatingPortalState }): unknown;
  render: ComponentRenderFn<HTMLProps, FloatingPortalState>;
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

const { element, elementProps, containerElement, deactivated } = useFloatingPortalNode({
  container: () => props.container,
  componentProps: props,
  // The capture phase runs these listeners before a listener of the focus manager.
  props: () =>
    modal.value ? undefined : { onFocusinCapture: handleFocus, onFocusoutCapture: handleFocus },
});

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

const shouldRenderGuards = computed(() => {
  const focusManager = focusManagerState.value;
  return focusManager !== null && !focusManager.modal && focusManager.open;
});

// The `id` attribute and the `#render` slot can replace the generated id. The owner element must
// name the id that the DOM has, so the part reads it after each DOM update.
const nodeId = shallowRef<string | undefined>();

function readNodeId() {
  nodeId.value = element.value?.id || undefined;
}

onUpdated(readNodeId);

const beforeOutsideGuard = useTemplateRef('beforeOutsideGuard');
const afterOutsideGuard = useTemplateRef('afterOutsideGuard');
const beforeOutsideRef = computed(() => beforeOutsideGuard.value?.element ?? null);
const afterOutsideRef = computed(() => afterOutsideGuard.value?.element ?? null);
const beforeInsideRef = shallowRef<HTMLSpanElement | null>(null);
const afterInsideRef = shallowRef<HTMLSpanElement | null>(null);

provide(PortalContext, {
  portalNode: element,
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
  <template v-if="containerElement">
    <FocusGuard
      v-if="shouldRenderGuards"
      ref="beforeOutsideGuard"
      data-type="outside"
      @focusin="handleBeforeGuardFocusin"
    />
    <span
      v-if="shouldRenderGuards"
      :role="portalOwnerRole"
      :aria-owns="nodeId"
      :style="ownerVisuallyHidden"
    />
    <Teleport :to="containerElement" :disabled="deactivated">
      <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
      <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
    </Teleport>
    <FocusGuard
      v-if="shouldRenderGuards"
      ref="afterOutsideGuard"
      data-type="outside"
      @focusin="handleAfterGuardFocusin"
    />
  </template>
</template>
