<script setup lang="ts">
import type { ToastLabel } from '../useToastManager';

defineProps<{
  label?: ToastLabel | undefined;
}>();
</script>

<template>
  <component :is="label" v-if="typeof label === 'function'" />
  <template v-else-if="label !== undefined">{{ label }}</template>
</template>
