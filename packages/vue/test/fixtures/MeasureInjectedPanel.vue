<script setup lang="ts">
import { provide, type PropType } from 'vue';
import MeasureInjectedChild from './MeasureInjectedChild.vue';

// A `<Transition>` around a component that renders its root element while the injected
// `scene.open` is true. A change of `scene.version` renders the `<Transition>` again.
const props = defineProps({
  scene: { type: Object as PropType<{ open: boolean; version?: number }>, required: true },
});
provide('measure scene', props.scene);
</script>

<template>
  <Transition name="measure-panel">
    <MeasureInjectedChild :data-version="scene.version" />
  </Transition>
</template>

<style>
.measure-panel-enter-active,
.measure-panel-leave-active {
  transition: opacity 200ms linear;
}
.measure-panel-enter-from,
.measure-panel-leave-to {
  opacity: 0;
}
</style>
