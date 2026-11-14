<script setup lang="ts">
import { Select } from '@vase-ui/vue/select';

const items = [
  { value: null, label: 'Select theme' },
  { value: 'system', label: 'System default' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];
</script>

<template>
  <Select.Root :items="items">
    <Select.Value />
  </Select.Root>
</template>
