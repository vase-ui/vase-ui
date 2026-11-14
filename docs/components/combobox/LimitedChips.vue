<script setup lang="ts">
import { Combobox } from '@vase-ui/vue/combobox';

const CHIP_LIMIT = 3;

const fruits = ['Apple', 'Banana', 'Cherry', 'Grape', 'Mango'];
</script>

<template>
  <Combobox.Root multiple :items="fruits">
    <Combobox.InputGroup>
      <Combobox.Value v-slot="{ value: selectedValue }">
        <Combobox.Chips>
          <Combobox.Chip
            v-for="item in selectedValue.slice(0, CHIP_LIMIT)"
            :key="item"
            aria-description="Press Backspace or Delete to remove"
          >
            {{ item }}
            <Combobox.ChipRemove :aria-label="`Remove ${item}`" />
          </Combobox.Chip>
          <span v-if="selectedValue.length > CHIP_LIMIT">
            +{{ selectedValue.length - CHIP_LIMIT }} more
          </span>
          <Combobox.Input
            :aria-description="
              selectedValue.length > 0
                ? `${selectedValue.length} selected. From the start of the input, press Left Arrow to focus the selected items`
                : undefined
            "
          />
        </Combobox.Chips>
      </Combobox.Value>
    </Combobox.InputGroup>
    <!-- ... -->
  </Combobox.Root>
</template>
