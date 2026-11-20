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
  <Combobox.Item v-slot="{ state }" :value="item">
    <span v-if="state.selected">✓</span>
    <span>{{ item.label }}</span>
  </Combobox.Item>
</template>
