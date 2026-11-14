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
import { useRenderElement } from '../../internals/useRenderElement';
import { popupStateMapping } from '../../utils/popups/popupStateMapping';
import { useNavigationMenuPositionerContext } from '../positioner/NavigationMenuPositionerContext';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NavigationMenuArrowProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: NavigationMenuArrowState }): unknown;
  render: ComponentRenderFn<HTMLProps, NavigationMenuArrowState>;
}>();

const { open, transitionStatus } = useNavigationMenuRootContext();
const { arrowRef, side, align, arrowUncentered, arrowStyles } =
  useNavigationMenuPositionerContext();

const state = computed<NavigationMenuArrowState>(() => ({
  open: open.value,
  side: side.value,
  align: align.value,
  uncentered: arrowUncentered.value,
}));

const { element, elementProps } = useRenderElement('div', props, {
  state,
  stateAttributesMapping: popupStateMapping,
  ref: arrowRef,
  props: (attrs) => [
    { style: arrowStyles.value, 'aria-hidden': true },
    getDisabledMountTransitionStyles(transitionStatus.value),
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
