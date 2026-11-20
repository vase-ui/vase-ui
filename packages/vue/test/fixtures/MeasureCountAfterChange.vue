<script setup lang="ts">
import { nextTick, provide, shallowReactive, watch, type PropType } from 'vue';
import MeasureCountedItem from './MeasureCountedItem.vue';

// Each item adds itself to the list in a post-flush watcher, as a slot adds itself to its root. A
// Vapor app reads a root prop that is a function as a getter, so the log is an object.
const props = defineProps({
  scene: { type: Object as PropType<{ count: number }>, required: true },
  log: { type: Object as PropType<{ add(entry: string): void }>, required: true },
});
const items = shallowReactive<object[]>([]);
provide('items', items);
watch(
  () => props.scene.count,
  async () => {
    props.log.add(`watcher ${items.length}`);
    await nextTick();
    props.log.add(`tick ${items.length}`);
  },
  { flush: 'post' },
);
</script>

<template>
  <div>
    <MeasureCountedItem v-for="n in scene.count" :key="n" />
  </div>
</template>
