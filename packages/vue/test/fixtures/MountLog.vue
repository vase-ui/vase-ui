<script setup lang="ts">
import { onMounted } from 'vue';

// Emits `mount` at each mount.
const emit = defineEmits<{ mount: [] }>();
onMounted(() => emit('mount'));
</script>

<template>
  <span>Mounted</span>
</template>
