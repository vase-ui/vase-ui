<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { Align, Side } from '../../internals/useAnchorPositioning';

export interface ToastArrowState {
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side;
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the arrow cannot be centered on the anchor.
   */
  uncentered: boolean;
}

export interface ToastArrowProps
  extends
    VaseUIComponentProps<ToastArrowState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useToastPositionerContext } from '../positioner/ToastPositionerContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ToastArrowProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: ToastArrowState }): unknown;
  render: ComponentRenderFn<HTMLProps, ToastArrowState>;
}>();

const { arrowRef, side, align, arrowUncentered, arrowStyles } = useToastPositionerContext();

const state = computed<ToastArrowState>(() => ({
  side: side.value,
  align: align.value,
  uncentered: arrowUncentered.value,
}));

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: [arrowRef],
  props: (attrs) => [{ style: arrowStyles.value, 'aria-hidden': true }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
