<script setup lang="ts">
import type { PropType } from 'vue';
import { Combobox } from '../../src/combobox';
import ComboboxFilteredWindow from './ComboboxFilteredWindow.vue';

// A virtualized combobox of five numbers that renders the filtered items from `from` to `to`, with
// their place in `index` when `indexed`.
defineProps({
  root: Object as PropType<Record<string, unknown>>,
  from: { type: Number, default: 0 },
  to: { type: Number, default: Infinity },
  indexed: Boolean,
});
const NUMBERS = ['one', 'two', 'three', 'four', 'five'];
</script>

<template>
  <Combobox.Root virtualized :items="NUMBERS" v-bind="root">
    <Combobox.Input data-testid="input" />
    <Combobox.Portal>
      <Combobox.Positioner>
        <Combobox.Popup data-testid="popup">
          <Combobox.List>
            <ComboboxFilteredWindow :from="from" :to="to" :indexed="indexed" />
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
</template>
