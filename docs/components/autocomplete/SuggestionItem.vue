<script lang="ts">
export interface Suggestion {
  id: string;
  label: string;
  description: string;
}
</script>

<script setup lang="ts">
import { Autocomplete } from '@vase-ui/vue/autocomplete';

defineProps<{ item: Suggestion }>();
</script>

<template>
  <Autocomplete.Item :value="item">
    <span>{{ item.label }}</span>
    <span>{{ item.description }}</span>
  </Autocomplete.Item>
</template>
