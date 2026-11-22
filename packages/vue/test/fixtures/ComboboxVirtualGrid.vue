<script setup lang="ts">
import { computed, shallowRef, type PropType } from 'vue';
import { Combobox } from '../../src/combobox';
import ComboboxVirtualGridRows from './ComboboxVirtualGridRows.vue';

// A grid of `count` items in rows of 5. With `virtualized`, the list renders a window of 3 rows
// from the row `start`, and the window follows the row of the highlight. Else it renders each row.
const props = defineProps({
  root: Object as PropType<Record<string, unknown>>,
  count: { type: Number, default: 100 },
  virtualized: Boolean,
  dir: String,
});
const items = computed(() => Array.from({ length: props.count }, (_, index) => `Item ${index}`));
const start = shallowRef(0);
const highlights = shallowRef<string[]>([]);

function onHighlight(value: unknown, details: { index: number }) {
  highlights.value = [...highlights.value, String(value)];
  if (details.index === -1) return;
  const row = Math.floor(details.index / 5);
  if (row >= start.value + 3) start.value = row - 2;
  if (row < start.value) start.value = row;
}

defineExpose({ highlights, start });
</script>

<template>
  <Combobox.Root
    grid
    :virtualized="virtualized"
    :items="items"
    v-bind="root"
    @item-highlighted="onHighlight"
  >
    <Combobox.Input data-testid="input" />
    <Combobox.Portal>
      <Combobox.Positioner>
        <Combobox.Popup data-testid="popup">
          <Combobox.List :dir="dir">
            <ComboboxVirtualGridRows
              :start="virtualized ? start : 0"
              :rows="virtualized ? 3 : Infinity"
            />
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
</template>
