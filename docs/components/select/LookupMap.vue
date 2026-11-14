<script setup lang="ts">
import { Select } from '@vase-ui/vue/select';

const items: Record<string, string> = {
  monospace: 'Monospace',
  serif: 'Serif',
  'sans-serif': 'Sans-serif',
};
</script>

<template>
  <Select.Root :items="items">
    <Select.Value v-slot="{ value }">
      <span :style="{ fontFamily: value }">{{ items[value] }}</span>
    </Select.Value>
  </Select.Root>
</template>
