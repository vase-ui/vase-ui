<script setup lang="ts">
import { computed, mergeProps, onUnmounted, provide, useAttrs, watch } from 'vue';
import { useElement } from '../common/element';
import { usePlacement } from '../popup/placement';
import { injectComboboxRoot, injectPortal, positionerKey } from './root';
import type { ComboboxPositionerProps, ComboboxPositionerState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxPositionerProps>(), {
  side: 'bottom',
  align: 'center',
  sideOffset: 0,
  alignOffset: 0,
  anchor: undefined,
  collisionAvoidance: () => ({ fallbackAxisSide: 'none' }),
  collisionBoundary: 'clipping-ancestors',
  collisionPadding: 5,
  sticky: false,
  arrowPadding: 5,
  positionMethod: 'absolute',
  disableAnchorTracking: false,
});
defineSlots<{
  default?(scope: { state: ComboboxPositionerState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ComboboxPositionerState;
  }): unknown;
}>();

const context = injectComboboxRoot('Positioner');
injectPortal(context, 'Positioner');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
// The default anchor is the control, or the group around the input.
const placementProps = new Proxy(props, {
  get: (target, key) =>
    key === 'anchor' ? (target.anchor ?? (() => context.anchor)) : Reflect.get(target, key),
});
const placement = usePlacement(context.root, placementProps, {
  positioner: element,
  insets: () => false,
  // A filter that makes the popup smaller does not flip it back.
  lazyFlip: () => true,
});
watch(
  [element, placement.placed, placement.side],
  ([positioner, placed, side]) => {
    context.positioner.value = positioner;
    context.placed.value = placed;
    context.side.value = positioner ? side : null;
  },
  { flush: 'sync', immediate: true },
);
onUnmounted(() => {
  context.positioner.value = null;
  context.placed.value = false;
  context.side.value = null;
});
provide(positionerKey, placement);

const state = computed<ComboboxPositionerState>(() => ({
  open: context.root.open,
  side: placement.side.value,
  align: placement.align.value,
  anchorHidden: placement.anchorHidden.value,
  empty: context.empty,
}));

function elementProps() {
  return mergeProps(
    {
      style: placement.style.value,
      'data-side': state.value.side,
      'data-align': state.value.align,
      'data-anchor-hidden': state.value.anchorHidden ? '' : undefined,
      'data-empty': state.value.empty ? '' : undefined,
    },
    attrs,
  );
}

defineExpose({ element });
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
