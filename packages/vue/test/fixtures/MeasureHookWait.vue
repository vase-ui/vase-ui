<script setup lang="ts">
import type { PropType } from 'vue';

const props = defineProps({ gate: { type: Promise as PropType<Promise<void>>, required: true } });
await props.gate;
</script>

<template>
  <i />
</template>
