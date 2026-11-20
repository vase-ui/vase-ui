<script setup lang="ts">
import { onMounted, onScopeDispose, onUnmounted, watchPostEffect, type PropType } from 'vue';
import MeasureHookChild from './MeasureHookChild.vue';
import MeasureHookWait from './MeasureHookWait.vue';

// A page that writes its hooks and a post-flush effect of its `setup` in `log`. With `gate`, it has
// a child with an async `setup` that waits for the gate, so a `<Suspense>` waits for the page.
const props = defineProps({
  name: { type: String, required: true },
  log: { type: Object as PropType<{ add(entry: string): void }>, required: true },
  gate: Promise as PropType<Promise<void>>,
});
props.log.add(`setup ${props.name}`);
watchPostEffect((onCleanup) => {
  props.log.add(`effect ${props.name}`);
  onCleanup(() => props.log.add(`effect end ${props.name}`));
});
onScopeDispose(() => props.log.add(`scope end ${props.name}`));
onMounted(() => props.log.add(`mounted ${props.name}`));
onUnmounted(() => props.log.add(`unmounted ${props.name}`));
</script>

<template>
  <div>
    <MeasureHookChild :name :log />
    <MeasureHookWait v-if="gate" :gate />
  </div>
</template>
