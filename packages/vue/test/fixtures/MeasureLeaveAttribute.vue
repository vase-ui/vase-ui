<script setup lang="ts">
import type { PropType } from 'vue';

// A panel in `<Transition>` that leaves when an attribute of it changes. The leave hook writes the
// attribute that the element has when its leave starts.
defineProps({
  scene: {
    type: Object as PropType<{ shown: boolean; direction: string }>,
    required: true,
  },
  log: { type: Array as PropType<(string | null)[]>, required: true },
});
</script>

<template>
  <Transition
    @leave="(element: Element) => log.push(element.getAttribute('data-activation-direction'))"
  >
    <div v-if="scene.shown" :data-activation-direction="scene.direction">Panel</div>
  </Transition>
</template>
