<script setup lang="ts">
import { Combobox } from '../../src/combobox';

// A combobox whose input is a `<textarea>` in the `element` slot.
const FRUITS = ['Apple', 'Banana'];
</script>

<template>
  <Combobox.Root :items="FRUITS">
    <Combobox.Input>
      <template #element="{ props, elementRef }">
        <textarea v-bind="props" :ref="elementRef" aria-label="Fruit" />
      </template>
    </Combobox.Input>
    <Combobox.Portal>
      <Combobox.Positioner>
        <Combobox.Popup data-testid="popup">
          <Combobox.List>
            <template #item="{ item }">
              <Combobox.Item :value="item">{{ item }}</Combobox.Item>
            </template>
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
</template>
