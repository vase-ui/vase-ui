<script setup lang="ts">
import { Combobox } from '@vase-ui/vue/combobox';

interface ProduceGroupItem {
  value: string;
  items: string[];
}

const groups: ProduceGroupItem[] = [
  {
    value: 'Fruits',
    items: ['Apple', 'Banana', 'Orange'],
  },
  {
    value: 'Vegetables',
    items: ['Carrot', 'Lettuce', 'Spinach'],
  },
];
</script>

<template>
  <Combobox.Root :items="groups">
    <Combobox.Input />
    <Combobox.Portal>
      <Combobox.Positioner>
        <Combobox.Popup>
          <Combobox.List>
            <template #item="{ item: group }">
              <Combobox.Group>
                <Combobox.GroupLabel>{{ group.value }}</Combobox.GroupLabel>
                <template v-for="item in group.items" :key="item.value">
                  <Combobox.Item :value="item">{{ item }}</Combobox.Item>
                </template>
              </Combobox.Group>
            </template>
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
</template>
