<script setup lang="ts">
import { mergeProps, useAttrs } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { useMenuPositioner } from './positioner';
import type { MenuPositionerProps, MenuPositionerState } from './types';

defineOptions({ inheritAttrs: false });

// A prop with no value takes the default of the place of the menu.
const props = withDefaults(defineProps<MenuPositionerProps>(), {
  side: undefined,
  align: undefined,
  sideOffset: undefined,
  alignOffset: undefined,
  anchor: undefined,
  collisionAvoidance: undefined,
  collisionBoundary: 'clipping-ancestors',
  collisionPadding: 5,
  sticky: false,
  arrowPadding: undefined,
  positionMethod: 'absolute',
  disableAnchorTracking: false,
});
defineSlots<{
  default?(scope: { state: MenuPositionerState }): unknown;
  element?(scope: ElementSlotProps<MenuPositionerState>): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const { state, attributes } = useMenuPositioner(props, element);

function elementProps() {
  return mergeProps(attributes(), attrs);
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
    <slot :state="state" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
