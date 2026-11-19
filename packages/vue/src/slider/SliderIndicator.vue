<script setup lang="ts">
import { computed, mergeProps, onMounted, shallowRef, useAttrs, watch, type CSSProperties } from 'vue';
import type { HTMLAttributes } from 'vue';
import { useElement } from '../common/element';
import { injectSlider, stateAttributes } from './root';
import type { SliderIndicatorState } from './types';
import { percent } from './values';

// The part takes the attributes of its element.
interface Attributes extends /* @vue-ignore */ HTMLAttributes {}

defineOptions({ inheritAttrs: false });

defineProps<Attributes>();

defineSlots<{
  default?(scope: { state: SliderIndicatorState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: SliderIndicatorState;
  }): unknown;
}>();

const slider = injectSlider('Indicator');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLDivElement>();
// For `edge`, the size on the axis of the first and of the last thumb, after the mount.
const thumbSizes = shallowRef<[first: number, last: number]>();

// CSS has no way to the centre of an `edge` thumb without its size.
onMounted(() => {
  watch(
    [
      () => slider.edge && slider.thumbs[0]?.element,
      () => slider.edge && slider.thumbs[slider.state.values.length - 1]?.element,
      () => slider.state.orientation,
    ],
    ([first, last, orientation], _, onCleanup) => {
      thumbSizes.value = undefined;
      if (!first || !last) return;
      const size = (thumb: HTMLElement) =>
        orientation === 'vertical' ? thumb.offsetHeight : thumb.offsetWidth;
      const observer = new ResizeObserver(() => (thumbSizes.value = [size(first), size(last)]));
      observer.observe(first);
      observer.observe(last);
      onCleanup(() => observer.disconnect());
    },
    { immediate: true },
  );
});

const style = computed<CSSProperties>(() => {
  const { values, orientation, min } = slider.state;
  const sizes = thumbSizes.value;
  const range = values.length > 1;
  const [low = min] = values;
  const first = range ? percent(low, slider.state) : 0;
  const last = percent(values.at(-1) ?? min, slider.state);
  // For `edge`, an end that has a thumb is at the centre of that thumb.
  const toCentre = (place: number, size: number) => (0.5 - place / 100) * size;
  const startShift = range && sizes ? toCentre(first, sizes[0]) : 0;
  const endShift = sizes ? toCentre(last, sizes[1]) : 0;
  const css = (place: number, shift: number) =>
    shift ? `calc(${place}% + ${shift}px)` : `${place}%`;
  const start = css(first, startShift);
  const length = css(last - first, endShift - startShift);
  return orientation === 'vertical'
    ? { position: 'absolute', width: 'inherit', bottom: start, height: length }
    : { position: 'relative', height: 'inherit', insetInlineStart: start, width: length };
});

defineExpose({ element });

function elementProps() {
  return mergeProps({ ...stateAttributes(slider.state), style: style.value }, attrs);
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
