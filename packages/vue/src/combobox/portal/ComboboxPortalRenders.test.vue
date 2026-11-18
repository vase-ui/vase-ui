<script setup lang="ts">
import { Combobox } from '@vase-ui/vue/combobox';

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
        @vue:mounted="onPositionerRender"
        @vue:updated="onPositionerRender"
      >
        <Combobox.Popup @vue:mounted="onPopupRender" @vue:updated="onPopupRender">
          <Combobox.List @vue:mounted="onListRender" @vue:updated="onListRender">
            <template #item="{ item }">
              <Combobox.Item
                :key="item"
                :value="item"
                @vue:mounted="onItemRender"
                @vue:updated="onItemRender"
              >
                {{ item }}
              </Combobox.Item>
            </template>
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
</template>
