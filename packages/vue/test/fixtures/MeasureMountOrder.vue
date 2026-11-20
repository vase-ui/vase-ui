<script setup lang="ts">
import { onBeforeMount, onMounted, type PropType } from 'vue';

// A component in a component, `depth` levels deep. Each level writes its hooks in `log`.
const props = defineProps({
  depth: { type: Number, required: true },
  log: { type: Object as PropType<{ add(entry: string): void }>, required: true },
});
onBeforeMount(() => props.log.add(`beforeMount ${props.depth}`));
onMounted(() => props.log.add(`mounted ${props.depth}`));
</script>

<template>
  <div>
    <MeasureMountOrder v-if="depth > 0" :depth="depth - 1" :log="log" />
  </div>
</template>
