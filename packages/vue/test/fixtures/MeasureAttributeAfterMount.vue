<script setup lang="ts">
import { nextTick, onMounted, shallowRef, watch, type PropType } from 'vue';

// With `child`, a button that is disabled until its mount. Without it, a parent that renders such
// a child while `scene.open`. A function ref of the element around the child starts a watcher with
// `flush: 'post'`. The watcher logs if the button is disabled, and a `nextTick` from it logs it
// again.
const props = defineProps({
  child: Boolean,
  scene: Object as PropType<{ open: boolean }>,
  log: Object as PropType<{ add(entry: string): void }>,
});
const mounted = shallowRef(false);
onMounted(() => (mounted.value = true));
const element = shallowRef<Element | null>(null);
const setElement = (value: unknown) => (element.value = value as Element | null);
watch(
  element,
  (current) => {
    const button = current?.querySelector('button');
    if (!button) return;
    props.log?.add(`watcher ${button.disabled}`);
    void nextTick(() => props.log?.add(`nextTick ${button.disabled}`));
  },
  { flush: 'post' },
);
</script>

<template>
  <button v-if="child" :disabled="!mounted">Child</button>
  <div v-else-if="scene?.open" :ref="setElement">
    <MeasureAttributeAfterMount child />
  </div>
</template>
