<script setup lang="ts">
import { Select, createListCollection } from '@ark-ui/vue/select';
import { options } from '../../harness/options.ts';

const collection = createListCollection({ items: options });
</script>

<template>
  <Select.Root :collection="collection">
    <Select.Label>Label</Select.Label>
    <Select.Control>
      <Select.Trigger data-bench="trigger">
        <Select.ValueText />
      </Select.Trigger>
    </Select.Control>
    <Teleport to="body">
      <Select.Positioner>
        <Select.Content data-bench="popup">
          <Select.Item v-for="item in collection.items" :key="item" :item="item">
            <Select.ItemText>{{ item }}</Select.ItemText>
          </Select.Item>
        </Select.Content>
      </Select.Positioner>
    </Teleport>
    <Select.HiddenSelect />
  </Select.Root>
</template>
