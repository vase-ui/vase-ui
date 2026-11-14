<script lang="ts">
export interface Fruit {
  id: string;
  label: string;
}
</script>

<script setup lang="ts">
import { Combobox } from '@vase-ui/vue/combobox';

defineProps<{ item: Fruit }>();
</script>

<template>
  <Combobox.Item :value="item">
    <Combobox.ItemIndicator />
    <span>{{ item.label }}</span>
  </Combobox.Item>
</template>
