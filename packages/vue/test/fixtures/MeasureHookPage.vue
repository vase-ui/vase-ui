<script setup lang="ts">
import { onMounted, onScopeDispose, onUnmounted, watchPostEffect, type PropType } from 'vue';
import MeasureHookChild from './MeasureHookChild.vue';
import MeasureHookWait from './MeasureHookWait.vue';

// A page that writes its hooks and a post-flush effect of its `setup` in `log`. With `gate`, it has
// a child with an async `setup` that waits for the gate, so a `<Suspense>` waits for the page.
const props = defineProps({
  name: { type: String, required: true },
  log: { type: Array as PropType<string[]>, required: true },
  gate: Promise as PropType<Promise<void>>,
});
props.log.push(`setup ${props.name}`);
watchPostEffect((onCleanup) => {
  props.log.push(`effect ${props.name}`);
  onCleanup(() => props.log.push(`effect end ${props.name}`));
});
onScopeDispose(() => props.log.push(`scope end ${props.name}`));
onMounted(() => props.log.push(`mounted ${props.name}`));
onUnmounted(() => props.log.push(`unmounted ${props.name}`));
</script>

<template>
  <div>
    <MeasureHookChild :name :log />
    <MeasureHookWait v-if="gate" :gate />
  </div>
</template>
