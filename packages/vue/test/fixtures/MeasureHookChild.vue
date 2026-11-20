<script setup lang="ts">
import { onMounted, type PropType } from 'vue';

const props = defineProps({
  name: { type: String, required: true },
  log: { type: Array as PropType<string[]>, required: true },
});
onMounted(() => props.log.push(`child mounted ${props.name}`));
</script>

<template>
  <span />
</template>
