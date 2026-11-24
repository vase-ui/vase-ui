<script setup lang="ts">
import type { PropType } from 'vue';
import { Combobox } from '../../src/combobox';

// With `inputInPopup`, the popup stays in the form.
defineProps({ root: Object as PropType<Record<string, unknown>>, inputInPopup: Boolean });
const FRUITS = ['Apple', 'Banana'];
</script>

<template>
  <form data-testid="form">
    <Combobox.Root :items="FRUITS" v-bind="root">
      <Combobox.Trigger v-if="inputInPopup" data-testid="trigger">
        <Combobox.Value />
      </Combobox.Trigger>
      <Combobox.Input v-else>
        <template #element="{ props, elementRef }">
          <textarea v-bind="props" :ref="elementRef" aria-label="Fruit" />
        </template>
      </Combobox.Input>
      <Combobox.Portal :disabled="inputInPopup">
        <Combobox.Positioner>
          <Combobox.Popup data-testid="popup">
            <Combobox.Input v-if="inputInPopup">
              <template #element="{ props, elementRef }">
                <textarea v-bind="props" :ref="elementRef" aria-label="Search" />
              </template>
            </Combobox.Input>
            <Combobox.List>
              <template #item="{ item }">
                <Combobox.Item :value="item">{{ item }}</Combobox.Item>
              </template>
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  </form>
</template>
