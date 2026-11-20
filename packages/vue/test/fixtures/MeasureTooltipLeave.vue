<script setup lang="ts">
import type { PropType } from 'vue';

// A popup in a `<Transition>` in a positioner in a `<Teleport>`. The leave of `fade` is a CSS
// transition of 10 s, and the leave of `spin` a CSS animation of 10 s. `[data-instant]` sets
// `transition: none` and `animation: none`.
defineProps({
  scene: {
    type: Object as PropType<{ open: boolean; portal: boolean; name: 'fade' | 'spin' }>,
    required: true,
  },
});
</script>

<template>
  <Teleport v-if="scene.portal" to="body">
    <div class="measure-positioner">
      <Transition :name="scene.name">
        <div v-if="scene.open" class="measure-tip">Tip</div>
      </Transition>
    </div>
  </Teleport>
</template>

<style>
.fade-leave-active {
  transition: opacity 10s;
}
.fade-leave-to {
  opacity: 0;
}
.spin-leave-active {
  animation: measure-out 10s forwards;
}
@keyframes measure-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
.measure-tip[data-instant] {
  transition: none;
  animation: none;
}
</style>
