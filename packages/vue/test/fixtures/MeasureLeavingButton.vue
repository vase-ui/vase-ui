<script setup lang="ts">
import { shallowRef } from 'vue';

// A button with a click listener in a `<Transition>` with a leave of 100 s, between two buttons.
// `hide()` starts the leave. `clicks` counts the clicks of the leaving button.
const shown = shallowRef(true);
const clicks = shallowRef(0);
defineExpose({
  hide: () => (shown.value = false),
  clicks,
});
</script>

<template>
  <button id="before">Before</button>
  <Transition name="measure-leave">
    <button v-if="shown" id="leaving" @click="clicks++">Leaving</button>
  </Transition>
  <button id="after">After</button>
</template>

<style>
.measure-leave-leave-active {
  transition: opacity 100s linear;
}
.measure-leave-leave-to {
  opacity: 0;
}
</style>
