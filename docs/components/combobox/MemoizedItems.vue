<script setup lang="ts">
import { Combobox } from '@vase-ui/vue/combobox';
import FruitItem from './FruitItem.vue';
import type { Fruit } from './FruitItem.vue';

const fruits: Fruit[] = [
  { id: 'apple', label: 'Apple' },
  { id: 'banana', label: 'Banana' },
];
</script>

<template>
  <Combobox.Root :items="fruits">
    <Combobox.Input />
    <Combobox.Portal>
      <Combobox.Positioner>
        <Combobox.Popup>
          <Combobox.List>
            <template #item="{ item }">
              <FruitItem :item="item" />
            </template>
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
</template>
