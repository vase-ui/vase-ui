<script setup lang="ts">
import type { PropType } from 'vue';
import { Combobox } from '../../src/combobox';

// A combobox in a form, whose input is a `<textarea>` in the `element` slot. `root` gives props to
// the root.
defineProps({ root: Object as PropType<Record<string, unknown>> });
const FRUITS = ['Apple', 'Banana'];
</script>

<template>
  <form data-testid="form">
    <Combobox.Root :items="FRUITS" v-bind="root">
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
  </form>
</template>
