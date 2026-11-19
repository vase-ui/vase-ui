<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { Align, Side } from '../../internals/useAnchorPositioning';

export interface ComboboxArrowState {
  /**
   * Whether the popup is currently open.
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

export interface ComboboxArrowProps
  extends
    VaseUIComponentProps<ComboboxArrowState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { usePopupArrow } from '../../utils/popups/usePopupArrow';
import { useComboboxPositionerContext } from '../positioner/ComboboxPositionerContext';
import { useComboboxRootContext } from '../root/ComboboxRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxArrowProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: ComboboxArrowState }): unknown;
  render: ComponentRenderFn<HTMLProps, ComboboxArrowState>;
}>();

const store = useComboboxRootContext();
const positioner = useComboboxPositionerContext();
const { element, elementProps, setRef, usesRenderSlot, state } = usePopupArrow(
  props,
  () => store.select('open'),
  positioner,
);

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
