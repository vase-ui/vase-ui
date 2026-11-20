<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { usePopupViewport } from '../popup/viewport';
import { injectPopoverRoot } from './root';
import type { PopoverViewportProps, PopoverViewportState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<PopoverViewportProps>();
defineSlots<{
  /** Give the content the `triggerId` as its `key` in a `<Transition>`, so that it leaves and enters at a move. */
  default?(scope: { state: PopoverViewportState; triggerId: string | null }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: PopoverViewportState;
  }): unknown;
}>();

const context = injectPopoverRoot('Viewport');
const { root } = context;
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const sizes = usePopupViewport(root, context.viewport, { triggerChange: true });

const state = computed<PopoverViewportState>(() => ({
  activationDirection: sizes.direction,
  transitioning: sizes.transitioning,
  instant: root.instant,
}));

function elementProps() {
  return mergeProps(
    {
      'data-activation-direction': sizes.direction,
      'data-instant': root.instant,
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
