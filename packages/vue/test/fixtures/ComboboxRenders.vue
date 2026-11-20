<script setup lang="ts">
import type { PropType } from 'vue';
import { Combobox } from '../../src/combobox';

// A combobox of 300 items that counts the renders of each part with a call in its slot.
defineProps({
  count: { type: Function as PropType<(part: string) => string>, required: true },
  root: Object as PropType<Record<string, unknown>>,
});
const ITEMS = Array.from({ length: 300 }, (_, index) => `Item ${index}`);
</script>

<template>
  <Combobox.Root :items="ITEMS" v-bind="root">
    {{ count('root') }}
    <Combobox.Input data-testid="input">
      <template #element="{ props, elementRef }">
        {{ count('input') }}<input v-bind="props" :ref="elementRef" />
      </template>
    </Combobox.Input>
    <Combobox.Portal>
      {{ count('portal') }}
      <Combobox.Positioner>
        {{ count('positioner') }}
        <Combobox.Popup data-testid="popup" style="max-height: 200px; overflow: auto">
          {{ count('popup') }}
          <Combobox.List>
            {{ count('list') }}
            <template #item="{ item }">
              <Combobox.Item :value="item" style="height: 20px">
                {{ count('item') }}{{ item }}
              </Combobox.Item>
            </template>
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
</template>
