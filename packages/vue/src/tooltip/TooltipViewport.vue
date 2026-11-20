<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { usePopupViewport } from '../popup/viewport';
import { injectTooltipRoot } from './root';
import type { TooltipViewportProps, TooltipViewportState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<TooltipViewportProps>();
defineSlots<{
  /** Give the content the `triggerId` as its `key` in a `<Transition>`, so that it leaves and enters at a move. */
  default?(scope: { state: TooltipViewportState; triggerId: string | null }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: TooltipViewportState;
  }): unknown;
}>();

const context = injectTooltipRoot('Viewport');
const { root } = context;
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const sizes = usePopupViewport(root, context.viewport, { instant: false });

const state = computed<TooltipViewportState>(() => ({
  activationDirection: sizes.direction,
  transitioning: sizes.transitioning,
  instant: context.instant,
}));

function elementProps() {
  return mergeProps(
    {
      'data-activation-direction': sizes.direction,
      'data-instant': context.instant,
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
    <slot :state="state" :triggerId="root.activeTriggerId" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" :triggerId="root.activeTriggerId" />
  </div>
</template>
