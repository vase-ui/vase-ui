<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface NavigationMenuIconState {
  /**
   * Whether the navigation menu is open and the item is active.
   */
  open: boolean;
}

export interface NavigationMenuIconProps
  extends
    VaseUIComponentProps<NavigationMenuIconState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import type { Component } from 'vue';
import type { HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { triggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { useNavigationMenuItemContext } from '../item/NavigationMenuItemContext';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import DownArrowChildren from '../../internals/DownArrowChildren.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NavigationMenuIconProps>(), { as: 'span' });

defineSlots<{
  default(props: { state: NavigationMenuIconState }): unknown;
  render(props: { props: HTMLProps; state: NavigationMenuIconState; children: Component }): unknown;
}>();

const { value: itemValue } = useNavigationMenuItemContext();
const { open, value } = useNavigationMenuRootContext();

const state = computed<NavigationMenuIconState>(() => ({
  open: open.value && value.value === itemValue.value,
}));

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('span', props, {
  state,
  props: (attrs) => [{ 'aria-hidden': true }, attrs],
  stateAttributesMapping: triggerOpenStateMapping,
  children: true,
});

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" :children="DownArrowChildren" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <DownArrowChildren><template v-if="$slots.default" #default><slot :state="state" /></template></DownArrowChildren>
  </component>
</template>
