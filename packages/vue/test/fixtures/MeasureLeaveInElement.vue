<script setup lang="ts">
import type { PropType } from 'vue';

// A popup in a `<Transition>` in a viewport element. With `viewportStays`, the viewport stays at
// the close, else the same update removes it.
defineProps({
  viewportStays: Boolean,
  scene: { type: Object as PropType<{ open: boolean }>, required: true },
});
</script>

<template>
  <div v-if="viewportStays || scene.open" id="viewport">
    <Transition name="t">
      <div v-if="scene.open" id="popup">Popup</div>
    </Transition>
  </div>
</template>

<style>
.t-leave-active {
  transition: opacity 300ms;
}
.t-leave-to {
  opacity: 0;
}
</style>
