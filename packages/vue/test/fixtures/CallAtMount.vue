<script setup lang="ts">
import { onMounted, type PropType } from 'vue';

// Calls `call` in `onMounted`.
const props = defineProps({ call: { type: Function as PropType<() => void>, required: true } });
onMounted(() => props.call());
</script>

<template>
  <span />
</template>
