<script setup lang="ts">
import * as Combobox from '../index.parts';

// A compiled template, as in an app. `stateClass` runs in each render of its part.
defineProps<{
  items: string[];
  sideOffset: number;
  onPositionerRender: () => undefined;
  onPopupRender: () => undefined;
  onListRender: () => undefined;
  onItemRender: () => undefined;
}>();
</script>

<template>
  <Combobox.Root :items="items" default-open>
    <Combobox.Input />
    <Combobox.Portal>
      <Combobox.Positioner
        data-testid="positioner"
        :side-offset="sideOffset"
        :state-class="onPositionerRender"
      >
        <Combobox.Popup :state-class="onPopupRender">
          <Combobox.List :state-class="onListRender">
            <template #item="{ item }">
              <Combobox.Item :key="item" :value="item" :state-class="onItemRender">
                {{ item }}
              </Combobox.Item>
            </template>
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
</template>
