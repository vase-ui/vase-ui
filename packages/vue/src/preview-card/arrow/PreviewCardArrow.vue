<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { Align, Side } from '../../internals/useAnchorPositioning';

export interface PreviewCardArrowState {
  /**
   * Whether the preview card is currently open.
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

export interface PreviewCardArrowProps
  extends
    VaseUIComponentProps<PreviewCardArrowState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { usePopupArrow } from '../../utils/popups/usePopupArrow';
import { usePreviewCardPositionerContext } from '../positioner/PreviewCardPositionerContext';
import { usePreviewCardRootContext } from '../root/PreviewCardContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PreviewCardArrowProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: PreviewCardArrowState }): unknown;
  render: ComponentRenderFn<HTMLProps, PreviewCardArrowState>;
}>();

const { open } = usePreviewCardRootContext();
const positioner = usePreviewCardPositionerContext();
const { element, elementProps, setRef, usesRenderSlot, state } = usePopupArrow(
  props,
  open,
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
