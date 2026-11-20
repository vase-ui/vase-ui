<script setup lang="ts">
import { computed, mergeProps, provide, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { usePlacement } from '../popup/placement';
import { sizeVariables } from '../popup/viewport';
import { injectPortal, injectTooltipRoot, positionerKey } from './root';
import type { TooltipPositionerProps, TooltipPositionerState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TooltipPositionerProps>(), {
  side: 'top',
  align: 'center',
  sideOffset: 0,
  alignOffset: 0,
  anchor: undefined,
  collisionAvoidance: undefined,
  collisionBoundary: 'clipping-ancestors',
  collisionPadding: 5,
  sticky: false,
  arrowPadding: 5,
  positionMethod: 'absolute',
  disableAnchorTracking: false,
});
defineSlots<{
  default?(scope: { state: TooltipPositionerState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: TooltipPositionerState;
  }): unknown;
}>();

const context = injectTooltipRoot('Positioner');
injectPortal('Positioner');
const { root } = context;
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const placement = usePlacement(root, props, {
  positioner: element,
  insets: () => !!context.viewport.value,
  anchor: () => context.cursor.anchor.value,
});
provide(positionerKey, placement);

const state = computed<TooltipPositionerState>(() => ({
  open: root.open,
  side: placement.side.value,
  align: placement.align.value,
  anchorHidden: placement.anchorHidden.value,
  instant: context.trackCursorAxis === 'none' ? context.instant : 'tracking-cursor',
}));

function elementProps() {
  return mergeProps(
    {
      style: [
        placement.style.value,
        sizeVariables('positioner', context.viewport.value?.positioner),
        // A popup that leaves, or that stays closed, takes no pointer from the page.
        context.hoverable && root.open ? undefined : { pointerEvents: 'none' },
      ],
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
