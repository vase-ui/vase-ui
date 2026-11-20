<script setup lang="ts">
import type { PropType } from 'vue';
import { Combobox } from '../../src/combobox';

type Props = Record<string, unknown>;

// A multiple combobox with a chip for each value, in the chips around the input.
defineProps({
  root: Object as PropType<Props>,
  items: { type: Array as PropType<string[]>, default: () => ['Apple', 'Banana', 'Cherry'] },
  input: Object as PropType<Props>,
});
</script>

<template>
  <Combobox.Root :items="items" multiple v-bind="root">
    <Combobox.Chips data-testid="chips">
      <template v-for="value in (root?.modelValue ?? []) as string[]" :key="value">
        <Combobox.Chip :data-testid="`chip-${value}`">
          {{ value }}
          <Combobox.ChipRemove :data-testid="`remove-${value}`" aria-label="Remove" />
        </Combobox.Chip>
      </template>
      <Combobox.Input data-testid="input" v-bind="input" />
    </Combobox.Chips>
    <Combobox.Portal>
      <Combobox.Positioner>
        <Combobox.Popup data-testid="popup">
          <Combobox.List>
            <template #item="{ item }">
              <Combobox.Item :value="item" :data-testid="`item-${item}`">{{ item }}</Combobox.Item>
            </template>
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
  <button id="outside">Outside</button>
</template>
