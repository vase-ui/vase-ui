<script setup lang="ts">
import { mergeProps, useAttrs } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { injectSlider, stateAttributes } from './root';
import type { SliderTrackProps, SliderTrackState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<SliderTrackProps>();

defineSlots<{
  default?(scope: { state: SliderTrackState }): unknown;
  element?(scope: ElementSlotProps<SliderTrackState>): unknown;
}>();

const slider = injectSlider('Track');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLDivElement>();

defineExpose({ element });

function elementProps() {
  // The thumbs and the indicator have their places in the track.
  return mergeProps({ ...stateAttributes(slider.state), style: { position: 'relative' } }, attrs);
}
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="slider.state"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="slider.state" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="slider.state" />
  </div>
</template>
