<script setup lang="ts">
import type { PropType } from 'vue';
import { Combobox } from '../../src/combobox';

// A combobox with its list in place.
defineProps({ root: Object as PropType<Record<string, unknown>> });
const FRUITS = ['Apple', 'Banana', 'Cherry'];
</script>

<template>
  <Combobox.Root inline :items="FRUITS" v-bind="root">
    <Combobox.Input data-testid="input" aria-label="Fruit" />
    <Combobox.Status data-testid="status">Three fruits.</Combobox.Status>
    <Combobox.List data-testid="list">
      <template #item="{ item }">
        <Combobox.Item :value="item" :data-testid="`item-${item}`">{{ item }}</Combobox.Item>
      </template>
    </Combobox.List>
  </Combobox.Root>
  <button id="outside">Outside</button>
</template>
