<script setup lang="ts">
import { computed, mergeProps, onUnmounted, provide, reactive, toRefs, useAttrs, watch } from 'vue';
import { useElement } from '../common/element';
import { usePlacement } from '../popup/placement';
import { useItemAlignment } from './alignment';
import { injectPortal, injectSelectRoot, selectPositionerKey } from './root';
import type { SelectPositionerProps, SelectPositionerState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SelectPositionerProps>(), {
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
  alignItemWithTrigger: true,
});
defineSlots<{
  default?(scope: { state: SelectPositionerState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: SelectPositionerState;
  }): unknown;
}>();

const context = injectSelectRoot('Positioner');
injectPortal('Positioner');
const { root, aligned } = context;
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const alignment = useItemAlignment(context, {
  enabled: () => props.alignItemWithTrigger,
  popupShown: () => context.popupShown.value,
});
const placement = usePlacement(
  root,
  // The popup that covers the trigger stays at its place.
  reactive({
    ...toRefs(props),
    disableAnchorTracking: computed(() => props.disableAnchorTracking || aligned.value),
  }),
  { positioner: element, insets: () => false, place: () => alignment.place.value },
);
const side = computed(() => (aligned.value ? 'none' : placement.side.value));
watch(
  [element, placement.placed, side],
  ([positioner, placed, current]) => {
    context.positioner.value = positioner;
    context.placed.value = placed;
    context.side.value = current;
  },
  { flush: 'sync', immediate: true },
);
onUnmounted(() => {
  context.positioner.value = null;
  context.placed.value = false;
  context.side.value = null;
});
provide(selectPositionerKey, {
  side,
  align: placement.align,
  arrow: placement.arrow,
  onScroll: alignment.onScroll,
});

const state = computed<SelectPositionerState>(() => ({
  open: root.open,
  side: side.value,
  align: placement.align.value,
  anchorHidden: placement.anchorHidden.value,
}));

function elementProps() {
  return mergeProps(
    {
      style: placement.style.value,
      'data-side': state.value.side,
      'data-align': state.value.align,
      'data-anchor-hidden': state.value.anchorHidden ? '' : undefined,
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
