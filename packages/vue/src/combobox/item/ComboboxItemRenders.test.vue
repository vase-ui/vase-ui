<script setup lang="ts">
import * as Combobox from '../index.parts';

// A compiled template, as in an app. The `#render` slot runs on each render of its item.
defineProps<{ items: string[]; onItemRender: () => void }>();
</script>

<template>
  <Combobox.Root :items="items" default-open>
    <Combobox.Input data-testid="input" />
    <Combobox.Portal>
      <Combobox.Positioner>
        <Combobox.Popup>
          <Combobox.List>
            <template #item="{ item }">
              <Combobox.Item :key="item" :value="item">
                <template #render="{ props: itemProps }">
                  <div v-bind="itemProps" :data-render="onItemRender()">{{ item }}</div>
                </template>
              </Combobox.Item>
            </template>
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
</template>
