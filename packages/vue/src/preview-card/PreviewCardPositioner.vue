<script setup lang="ts">
import { computed, mergeProps, provide, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { usePlacement } from '../popup/placement';
import { sizeVariables } from '../popup/viewport';
import { lineMiddleware } from './line';
import { injectPortal, injectPreviewCardRoot, positionerKey } from './root';
import type { PreviewCardPositionerProps, PreviewCardPositionerState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PreviewCardPositionerProps>(), {
  side: 'bottom',
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
  default?(scope: { state: PreviewCardPositionerState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: PreviewCardPositionerState;
  }): unknown;
}>();

const context = injectPreviewCardRoot('Positioner');
injectPortal('Positioner');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const placement = usePlacement(context.root, props, {
  positioner: element,
  insets: () => !!context.viewport.value,
  inline: lineMiddleware(() => context.line),
});
provide(positionerKey, placement);

const state = computed<PreviewCardPositionerState>(() => ({
  open: context.root.open,
  side: placement.side.value,
  align: placement.align.value,
  anchorHidden: placement.anchorHidden.value,
  instant: context.root.instant as PreviewCardPositionerState['instant'],
}));

function elementProps() {
  return mergeProps(
    {
      style: [
        placement.style.value,
        sizeVariables('positioner', context.viewport.value?.positioner),
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
