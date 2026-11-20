<script setup lang="ts">
import { defineComponent, h, inject, provide, type PropType } from 'vue';

// A popup in a `<Transition>` that renders its root element while `open`. The leave runs with CSS.
const props = defineProps({
  scene: { type: Object as PropType<{ open: boolean }>, required: true },
});
provide('scene', props.scene);

const Popup = defineComponent({
  setup() {
    const scene = inject<{ open: boolean }>('scene')!;
    return () => (scene.open ? h('div', { class: 'popup' }, 'Popup') : null);
  },
});
</script>

<template>
  <Transition name="reopen">
    <Popup />
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
