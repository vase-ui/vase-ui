<script setup lang="ts">
import { Select } from '@vase-ui/vue/select';

const items = [
  { value: 'system', label: 'System default' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];
</script>

<template>
  <Select.Root :items="items">
    <Select.Value placeholder="Select theme" />
  </Select.Root>
</template>
