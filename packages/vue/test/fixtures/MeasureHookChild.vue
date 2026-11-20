<script setup lang="ts">
import { onMounted, type PropType } from 'vue';

const props = defineProps({
  name: { type: String, required: true },
  log: { type: Object as PropType<{ add(entry: string): void }>, required: true },
});
onMounted(() => props.log.add(`child mounted ${props.name}`));
</script>

<template>
  <span />
</template>
