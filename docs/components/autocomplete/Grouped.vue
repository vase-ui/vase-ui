<script setup lang="ts">
import { Autocomplete } from '@vase-ui/vue/autocomplete';

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
  <Autocomplete.Root :items="groups">
    <Autocomplete.Input />
    <Autocomplete.Portal>
      <Autocomplete.Positioner>
        <Autocomplete.Popup>
          <Autocomplete.List>
            <template #item="{ item: group }">
              <Autocomplete.Group>
                <Autocomplete.GroupLabel>{{ group.value }}</Autocomplete.GroupLabel>
                <template v-for="item in group.items" :key="item.value">
                  <Autocomplete.Item :value="item">{{ item }}</Autocomplete.Item>
                </template>
              </Autocomplete.Group>
            </template>
          </Autocomplete.List>
        </Autocomplete.Popup>
      </Autocomplete.Positioner>
    </Autocomplete.Portal>
  </Autocomplete.Root>
</template>
