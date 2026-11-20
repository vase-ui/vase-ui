<script setup lang="ts">
import { defineComponent, h, inject, provide, type PropType } from 'vue';

// A `<Transition>` in a part that renders by state of its root, and a popup that renders its root
// element by the same state. Both mount in one update with an open.
const props = defineProps({
  appear: Boolean,
  scene: { type: Object as PropType<{ open: boolean }>, required: true },
});
provide('scene', props.scene);

const Popup = defineComponent({
  setup() {
    const scene = inject<{ open: boolean }>('scene')!;
    return () => (scene.open ? h('div', { id: 'popup' }, 'Popup') : null);
  },
});
const Portal = defineComponent({
  setup(_, { slots }) {
    const scene = inject<{ open: boolean }>('scene')!;
    return () => (scene.open ? h('div', { id: 'positioner' }, slots.default?.()) : null);
  },
});
</script>

<template>
  <Portal>
    <Transition name="m" :appear>
      <Popup />
    </Transition>
  </Portal>
</template>
