<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs, useId } from 'vue';
import { useElement } from '../common/element';
import { givenId } from '../common/id';
import { injectSlider, stateAttributes } from './root';
import type { SliderLabelProps, SliderLabelState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<SliderLabelProps>();
defineSlots<{
  default?(scope: { state: SliderLabelState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: SliderLabelState;
  }): unknown;
}>();

const slider = injectSlider('Label');
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLLabelElement>();
const elementId = computed(() => givenId(props.id) ?? generatedId);

// Nuxt removes the call of `onUnmounted` from its server build, with its arguments, so the
// part registers before the call.
const unregister = slider.addLabel({
  get id() {
    return elementId.value;
  },
});
onUnmounted(unregister);

defineExpose({ element });

function elementProps() {
  return mergeProps(
    {
      id: elementId.value,
      // The label of the input of the first thumb. Before the thumbs, it is the id that the first
      // thumb gets with no `id` prop.
      for: slider.thumbs.find(Boolean)?.id ?? slider.controlId,
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
  />
  <label v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="slider.state" />
  </label>
</template>
