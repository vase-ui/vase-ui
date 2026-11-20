<script setup lang="ts">
import { shallowRef } from 'vue';
import { Combobox } from '../../src/combobox';
import ComboboxVirtualWindow from './ComboboxVirtualWindow.vue';

// A combobox of 50 items that renders a window of 5 of the filtered items. The window follows the
// index of the highlight.
const ITEMS = Array.from({ length: 50 }, (_, index) => `Item ${index}`);
const start = shallowRef(0);
const highlights = shallowRef<string[]>([]);

function onHighlight(value: unknown, details: { index: number }) {
  highlights.value = [...highlights.value, `${String(value)} ${details.index}`];
  if (details.index >= start.value + 5) start.value = details.index - 4;
  if (details.index !== -1 && details.index < start.value) start.value = details.index;
}

defineExpose({ highlights });
</script>

<template>
  <Combobox.Root virtualized :items="ITEMS" @item-highlighted="onHighlight">
    <Combobox.Input data-testid="input" />
    <Combobox.Portal>
      <Combobox.Positioner>
        <Combobox.Popup data-testid="popup">
          <Combobox.List>
            <ComboboxVirtualWindow :start="start" />
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
</template>
