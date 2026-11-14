<script setup lang="ts">
import { Combobox } from '@vase-ui/vue/combobox';

const items = [
  { id: 'apple', label: 'Apple' },
  { id: 'banana', label: 'Banana' },
  { id: 'orange', label: 'Orange' },
];
</script>

<template>
  <Combobox.Root :items="items">
    <Combobox.Input />
    <Combobox.Portal>
      <Combobox.Positioner>
        <Combobox.Popup>
          <Combobox.List>
            <template #item="{ item }">
              <Combobox.Item :value="item">{{ item.label }}</Combobox.Item>
            </template>
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
</template>
