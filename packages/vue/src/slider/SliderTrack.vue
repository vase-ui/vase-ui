<script setup lang="ts">
import { mergeProps, useAttrs } from 'vue';
import type { HTMLAttributes } from 'vue';
import { useElement } from '../common/element';
import { injectSlider, stateAttributes } from './root';
import type { SliderTrackState } from './types';

// The part takes the attributes of its element.
interface Attributes extends /* @vue-ignore */ HTMLAttributes {}

defineOptions({ inheritAttrs: false });

defineProps<Attributes>();

defineSlots<{
  default?(scope: { state: SliderTrackState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: SliderTrackState;
  }): unknown;
}>();

const slider = injectSlider('Track');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLDivElement>();

defineExpose({ element });

function elementProps() {
  // The thumbs and the indicator have their places in the track.
  return mergeProps(
    { ...stateAttributes(slider.state), style: { position: 'relative' } },
    attrs,
  );
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
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="slider.state" />
  </div>
</template>
