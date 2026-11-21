<script setup lang="ts">
import type { PropType } from 'vue';
import { Combobox } from '../../src/combobox';

// A combobox of 300 items that counts the renders of each part with a call in its slot. Where the
// part gives the slot a scope, the call reads it.
defineProps({
  count: { type: Function as PropType<(part: string, scope?: unknown) => string>, required: true },
  root: Object as PropType<Record<string, unknown>>,
});
const ITEMS = Array.from({ length: 300 }, (_, index) => `Item ${index}`);
</script>

<template>
  <Combobox.Root :items="ITEMS" v-bind="root">
    {{ count('root') }}
    <Combobox.Input data-testid="input">
      <template #element="{ props, elementRef }">
        {{ count('input', props) }}<input v-bind="props" :ref="elementRef" />
      </template>
    </Combobox.Input>
    <Combobox.Portal>
      {{ count('portal') }}
      <Combobox.Positioner v-slot="{ state }">
        {{ count('positioner', state) }}
        <Combobox.Popup
          v-slot="{ state: popupState }"
          data-testid="popup"
          style="max-height: 200px; overflow: auto"
        >
          {{ count('popup', popupState) }}
          <Combobox.List>
            <template #default="{ state: listState }">{{ count('list', listState) }}</template>
            <template #item="{ item }">
              <Combobox.Item v-slot="{ state: itemState }" :value="item" style="height: 20px">
                {{ count('item', itemState) }}{{ item }}
              </Combobox.Item>
            </template>
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
</template>
