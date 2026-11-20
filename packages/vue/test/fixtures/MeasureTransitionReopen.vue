<script setup lang="ts">
import { provide, type PropType } from 'vue';
import MeasureScenePopup from './MeasureScenePopup.vue';

// A popup in a `<Transition>` that renders its root element while `open`. The leave runs with CSS.
const props = defineProps({
  scene: { type: Object as PropType<{ open: boolean }>, required: true },
});
provide('scene', props.scene);
</script>

<template>
  <Transition name="reopen">
    <MeasureScenePopup />
  </Transition>
</template>

<style>
.reopen-enter-active,
.reopen-leave-active {
  transition: opacity 200ms;
}
.reopen-enter-from,
.reopen-leave-to {
  opacity: 0;
}
</style>
