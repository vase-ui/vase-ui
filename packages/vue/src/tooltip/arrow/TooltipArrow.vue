<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { Align, Side } from '../../internals/useAnchorPositioning';

export interface TooltipArrowState {
  /**
   * Whether the tooltip is currently open.
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
  /**
   * Whether transitions should be skipped.
   */
  instant: 'delay' | 'dismiss' | 'focus' | undefined;
}

export interface TooltipArrowProps
  extends
    VaseUIComponentProps<TooltipArrowState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { popupStoreSelectors } from '../../utils/popups/usePopupRoot';
import { computed } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { popupStateMapping } from '../../utils/popups/popupStateMapping';
import { useTooltipPositionerContext, useTooltipRootContext } from '../root/TooltipRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TooltipArrowProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: TooltipArrowState }): unknown;
  render: ComponentRenderFn<HTMLProps, TooltipArrowState>;
}>();

const { store } = useTooltipRootContext();
const { arrowRef, side, align, arrowUncentered, arrowStyles } = useTooltipPositionerContext();

const state = computed<TooltipArrowState>(() => ({
  open: popupStoreSelectors.open(store.state),
  side: side.value,
  align: align.value,
  uncentered: arrowUncentered.value,
  instant: store.state.instantType,
}));

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  ref: arrowRef,
  stateAttributesMapping: popupStateMapping,
  props: (attrs) => [{ style: arrowStyles.value, 'aria-hidden': true }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
