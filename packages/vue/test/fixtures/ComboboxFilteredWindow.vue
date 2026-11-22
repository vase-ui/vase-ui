<script setup lang="ts">
import { computed } from 'vue';
import { Combobox } from '../../src/combobox';

// The items of the filtered items from `from` to `to`, with their place in `index` when `indexed`.
const props = defineProps<{ from: number; to: number; indexed: boolean }>();
const filtered = Combobox.useFilteredItems<string>();
const shown = computed(() =>
  filtered.value
    .slice(props.from, props.to)
    .map((item, offset) => ({ item, index: props.from + offset })),
);
</script>

<template>
  <Combobox.Item
    v-for="{ item, index } in shown"
    :key="item"
    :value="item"
    :index="indexed ? index : undefined"
    :data-testid="`item-${item}`"
  >
    {{ item }}
  </Combobox.Item>
</template>
