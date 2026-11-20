<script setup lang="ts">
import { shallowRef, watch, type PropType } from 'vue';

// An element that Vue keeps, with the `hidden` of `hiddenValue` while `scene.open` is false. The
// class `Variable` gives it the height of `--height` with a transition, and `Grid` gives it the grid
// rows of the docs. With `writes`, `--height` gets the scroll height after each open (`after`), or
// also before each change (`both`).
const props = defineProps({
  scene: { type: Object as PropType<{ open: boolean }>, required: true },
  kind: { type: String as PropType<'Variable' | 'VariableKeptBox' | 'Grid'>, required: true },
  writes: { type: String as PropType<'none' | 'after' | 'both'>, default: 'none' },
  hiddenValue: { type: [Boolean, String] as PropType<true | 'until-found'>, default: true },
});
const element = shallowRef<HTMLElement | null>(null);

function write() {
  element.value?.style.setProperty('--height', `${element.value.scrollHeight}px`);
}
if (props.writes === 'both') watch(() => props.scene.open, write);
if (props.writes !== 'none') {
  watch(
    () => props.scene.open,
    (open) => open && write(),
    { flush: 'post' },
  );
}
</script>

<template>
  <div ref="element" :class="kind" :hidden="scene.open ? undefined : hiddenValue">
    <div><p class="MeasureLine">Line 1</p><p class="MeasureLine">Line 2</p></div>
  </div>
</template>

<style>
.MeasureLine {
  margin: 0;
  height: 20px;
}
.Variable,
.VariableKeptBox {
  overflow: hidden;
  height: var(--height);
  transition: height 100ms linear;
}
.VariableKeptBox[hidden] {
  display: block;
  height: 0;
}
.Grid {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 100ms linear;
}
.Grid[hidden] {
  display: grid;
  grid-template-rows: 0fr;
}
.Grid > * {
  min-height: 0;
  overflow: hidden;
}
</style>
