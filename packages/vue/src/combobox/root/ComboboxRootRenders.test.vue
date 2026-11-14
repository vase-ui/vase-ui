<script setup lang="ts">
import * as Combobox from '../index.parts';

// A compiled template, as in an app. The `#item` slot runs on each render of the list.
defineProps<{ items: string[]; onItemRender: (item: string) => void }>();
</script>

<template>
  <Combobox.Root :items="items" :filtered-items="items" default-open>
    <Combobox.Input data-testid="input" />
    <Combobox.Portal>
      <Combobox.Positioner data-testid="positioner">
        <Combobox.Popup>
          <Combobox.List>
            <template #item="{ item }">
              <Combobox.Item :key="item" :value="item" :data-render="onItemRender(item)">
                {{ item }}
              </Combobox.Item>
            </template>
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
</template>
