<script setup lang="ts">
import { computed } from 'vue';
import { Combobox } from '../../src/combobox';

// The items of a window of 5 of the filtered items, from `start`.
const props = defineProps<{ start: number }>();
const filtered = Combobox.useFilteredItems<string>();
const shown = computed(() =>
  filtered.value
    .slice(props.start, props.start + 5)
    .map((item, offset) => ({ item, index: props.start + offset })),
);
</script>

<template>
  <Combobox.Item
    v-for="{ item, index } in shown"
    :key="item"
    :value="item"
    :index="index"
    :data-testid="`item-${index}`"
  >
    {{ item }}
  </Combobox.Item>
</template>
