<script setup lang="ts">
import { TimePicker } from '@vase-ui/vue/time-picker';

defineProps<{ open?: boolean; closeOnSelect?: boolean }>();
</script>

<template>
  <TimePicker.Root :open="open" :close-on-select="closeOnSelect">
    <slot />
  </TimePicker.Root>
</template>
