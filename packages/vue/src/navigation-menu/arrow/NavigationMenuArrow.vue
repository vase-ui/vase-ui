<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { Align, Side } from '../../internals/useAnchorPositioning';

export interface NavigationMenuArrowState {
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

export interface NavigationMenuArrowProps
  extends
    VaseUIComponentProps<NavigationMenuArrowState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { getDisabledMountTransitionStyles } from '../../internals/getDisabledMountTransitionStyles';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { usePopupArrow } from '../../utils/popups/usePopupArrow';
import { useNavigationMenuPositionerContext } from '../positioner/NavigationMenuPositionerContext';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NavigationMenuArrowProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: NavigationMenuArrowState }): unknown;
  render: ComponentRenderFn<HTMLProps, NavigationMenuArrowState>;
}>();

const { open, transitionStatus } = useNavigationMenuRootContext();
const positioner = useNavigationMenuPositionerContext();
const { state, element, elementProps, setRef, usesRenderSlot } = usePopupArrow(props, open, {
  ...positioner,
  arrowStyles: computed(() => ({
    ...positioner.arrowStyles.value,
    ...getDisabledMountTransitionStyles(transitionStatus.value).style,
  })),
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
