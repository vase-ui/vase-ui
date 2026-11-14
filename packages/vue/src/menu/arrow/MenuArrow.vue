<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { Align, Side } from '../../internals/useAnchorPositioning';

export interface MenuArrowState {
  /**
   * Whether the menu is currently open.
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

export interface MenuArrowProps
  extends VaseUIComponentProps<MenuArrowState>, /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { popupStateMapping } from '../../utils/popups/popupStateMapping';
import { useMenuPositionerContext } from '../positioner/MenuPositionerContext';
import { useMenuRootContext } from '../root/MenuRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MenuArrowProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: MenuArrowState }): unknown;
  render: ComponentRenderFn<HTMLProps, MenuArrowState>;
}>();

const { store } = useMenuRootContext();
const { arrowRef, side, align, arrowUncentered, arrowStyles } = useMenuPositionerContext();

const state = computed<MenuArrowState>(() => ({
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
