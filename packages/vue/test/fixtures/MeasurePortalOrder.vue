<script setup lang="ts">
import { defineComponent, h, onMounted, shallowRef, Teleport, type PropType } from 'vue';

// Two teleports to `<body>`, the child in the content of the parent, that render in one update.
// With `afterMount`, each one renders its teleport after its own mount, as a portal of a popup does.
const props = defineProps({
  afterMount: Boolean,
  defer: Boolean,
  scene: { type: Object as PropType<{ open: boolean }>, required: true },
});

const Portal = defineComponent({
  setup(_, { slots }) {
    const mounted = shallowRef(!props.afterMount);
    onMounted(() => (mounted.value = true));
    return () =>
      mounted.value ? h(Teleport, { to: 'body', defer: props.defer }, slots.default?.()) : null;
  },
});
</script>

<template>
  <Portal v-if="scene.open">
    <div id="parent">
      <Portal><div id="child" /></Portal>
    </div>
  </Portal>
</template>
