<script setup lang="ts">
import { Select, createListCollection } from '@ark-ui/vue/select';
import { options } from '../../../harness/options.ts';
import '../../../behavior/style.css';

const collection = createListCollection({ items: options });
</script>

<template>
  <div class="bench-page">
    <Select.Root :collection="collection" :default-value="['Option 1']">
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
  </div>
</template>

<style>
[data-scope='select'][data-part='content'] {
  transform-origin: var(--transform-origin);
}

[data-scope='select'][data-part='content'][data-state='open'] {
  animation: bench-enter var(--bench-duration) linear;
}

[data-scope='select'][data-part='content'][data-state='closed'] {
  animation: bench-exit var(--bench-duration) linear;
}
</style>
