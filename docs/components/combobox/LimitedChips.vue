<script setup lang="ts">
import { Combobox } from '@vase-ui/vue/combobox';

const CHIP_LIMIT = 3;

const fruits = ['Apple', 'Banana', 'Cherry', 'Grape', 'Mango'];

// The types of Vue do not list `aria-description`, so the sample gives it with `v-bind`.
const CHIP_DESCRIPTION = { 'aria-description': 'Press Backspace or Delete to remove' };

function getInputDescription(selectedCount: number) {
  return {
    'aria-description':
      selectedCount > 0
        ? `${selectedCount} selected. From the start of the input, press Left Arrow to focus the selected items`
        : undefined,
  };
}
</script>

<template>
  <Combobox.Root multiple :items="fruits">
    <Combobox.InputGroup>
      <Combobox.Value v-slot="{ value: selectedValue }">
        <Combobox.Chips>
          <Combobox.Chip
            v-for="item in selectedValue.slice(0, CHIP_LIMIT)"
            :key="item"
            v-bind="CHIP_DESCRIPTION"
          >
            {{ item }}
            <Combobox.ChipRemove :aria-label="`Remove ${item}`" />
          </Combobox.Chip>
          <span v-if="selectedValue.length > CHIP_LIMIT">
            +{{ selectedValue.length - CHIP_LIMIT }} more
          </span>
          <Combobox.Input v-bind="getInputDescription(selectedValue.length)" />
        </Combobox.Chips>
      </Combobox.Value>
    </Combobox.InputGroup>
    <!-- ... -->
  </Combobox.Root>
</template>
