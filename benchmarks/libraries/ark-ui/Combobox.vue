<script setup lang="ts">
import { Combobox, useListCollection } from '@ark-ui/vue/combobox';
import { useFilter } from '@ark-ui/vue/locale';
import { options } from '../../harness/options.ts';

const filters = useFilter({ sensitivity: 'base' });

const { collection, filter } = useListCollection({
  initialItems: options,
  filter: filters.value.contains,
});

function filterOptions(details: Combobox.InputValueChangeDetails) {
  filter(details.inputValue);
}
</script>

<template>
  <Combobox.Root :collection="collection" @input-value-change="filterOptions">
    <Combobox.Label>Label</Combobox.Label>
    <Combobox.Control>
      <Combobox.Input data-bench="input" />
      <Combobox.ClearTrigger>Clear</Combobox.ClearTrigger>
      <Combobox.Trigger data-bench="trigger">Open</Combobox.Trigger>
    </Combobox.Control>
    <Teleport to="body">
      <Combobox.Positioner>
        <Combobox.Content data-bench="popup">
          <Combobox.Empty>No results</Combobox.Empty>
          <Combobox.Item v-for="item in collection.items" :key="item" :item="item">
            <Combobox.ItemText>{{ item }}</Combobox.ItemText>
          </Combobox.Item>
        </Combobox.Content>
      </Combobox.Positioner>
    </Teleport>
  </Combobox.Root>
</template>
