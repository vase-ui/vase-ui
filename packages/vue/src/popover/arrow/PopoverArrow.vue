<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { Align, Side } from '../../internals/useAnchorPositioning';

export interface PopoverArrowState {
  /**
   * Whether the popover is currently open.
   */
  open: boolean;
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

export interface PopoverArrowProps
  extends
    VaseUIComponentProps<PopoverArrowState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { popupStateMapping } from '../../utils/popups/popupStateMapping';
import { usePopoverPositionerContext } from '../positioner/PopoverPositionerContext';
import { usePopoverRootContext } from '../root/PopoverRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PopoverArrowProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: PopoverArrowState }): unknown;
  render: ComponentRenderFn<HTMLProps, PopoverArrowState>;
}>();

const store = usePopoverRootContext();
const { arrowRef, side, align, arrowUncentered, arrowStyles } = usePopoverPositionerContext();

const state = computed<PopoverArrowState>(() => ({
  open: store.select('open'),
  side: side.value,
  align: align.value,
  uncentered: arrowUncentered.value,
}));

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: [arrowRef],
  stateAttributesMapping: popupStateMapping,
  props: (attrs) => [{ style: arrowStyles.value, 'aria-hidden': true }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
