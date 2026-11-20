<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import type { OutputHTMLAttributes } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { injectSlider, stateAttributes } from './root';
import type { SliderValueState } from './types';

// The part takes the attributes of its element.
interface Attributes extends /* @vue-ignore */ OutputHTMLAttributes {}

defineOptions({ inheritAttrs: false });

defineProps<Attributes>();

defineSlots<{
  default?(scope: {
    state: SliderValueState;
    values: readonly number[];
    formattedValues: readonly string[];
  }): unknown;
  element?(
    scope: ElementSlotProps<SliderValueState> & {
      values: readonly number[];
      formattedValues: readonly string[];
    },
  ): unknown;
}>();

const slider = injectSlider('Value');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLOutputElement>();
const formattedValues = computed(() => slider.state.values.map((value) => slider.text(value)));

defineExpose({ element });

function elementProps() {
  return mergeProps(
    {
      // A drag changes the value at each move, so the output announces nothing.
      'aria-live': 'off',
      for: slider.thumbs.flatMap((thumb) => (thumb ? [thumb.id] : [])).join(' ') || undefined,
      ...stateAttributes(slider.state),
    },
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
    :values="slider.state.values"
    :formattedValues="formattedValues"
  />
  <output v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="slider.state" :values="slider.state.values" :formattedValues="formattedValues">{{
      formattedValues.join(' – ')
    }}</slot>
  </output>
</template>
