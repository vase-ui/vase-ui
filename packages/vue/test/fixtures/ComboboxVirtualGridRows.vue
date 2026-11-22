<script setup lang="ts">
import { computed } from 'vue';
import { Combobox } from '../../src/combobox';

// `rows` rows of 5 of the filtered items, from the row `start`.
const props = defineProps<{ start: number; rows: number }>();
const filtered = Combobox.useFilteredItems<string>();
const shown = computed(() => {
  const rows: { row: number; cells: { item: string; index: number }[] }[] = [];
  const end = Math.min(props.start + props.rows, Math.ceil(filtered.value.length / 5));
  for (let row = props.start; row < end; row += 1) {
    const cells = filtered.value
      .slice(row * 5, row * 5 + 5)
      .map((item, column) => ({ item, index: row * 5 + column }));
    rows.push({ row, cells });
  }
  return rows;
});
</script>

<template>
  <Combobox.Row v-for="{ row, cells } in shown" :key="row">
    <Combobox.Item
      v-for="{ item, index } in cells"
      :key="item"
      :value="item"
      :index="index"
      :data-testid="`item-${index}`"
    >
      {{ item }}
    </Combobox.Item>
  </Combobox.Row>
</template>
