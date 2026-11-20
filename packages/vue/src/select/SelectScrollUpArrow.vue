<script setup lang="ts">
import { mergeProps, useAttrs } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { useScrollArrow } from './scrollArrow';
import type { SelectScrollUpArrowProps, SelectScrollUpArrowState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SelectScrollUpArrowProps>(), { keepMounted: false });
defineSlots<{
  /** The content. The default is `▲`. */
  default?(scope: { state: SelectScrollUpArrowState }): unknown;
  element?(scope: ElementSlotProps<SelectScrollUpArrowState>): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const { state, rendered, listeners } = useScrollArrow('up', element, () => props.keepMounted);

function elementProps() {
  return mergeProps(
    {
      'aria-hidden': 'true',
      hidden: state.value.visible ? undefined : true,
      style: { position: 'absolute' },
      'data-side': state.value.side,
      ...listeners,
    },
    attrs,
  );
}

defineExpose({ element });
</script>

<!-- The arrow is in the DOM while it shows, so a `<Transition>` around the part animates it. -->
<template>
  <slot
    v-if="rendered && $slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="rendered && as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state">▲</slot>
  </component>
  <div v-else-if="rendered" v-bind="elementProps()" :ref="setElement">
    <slot :state="state">▲</slot>
  </div>
</template>
