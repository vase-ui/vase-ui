<script setup lang="ts">
import type { PropType } from 'vue';
import { Combobox } from '../../src/combobox';

type Props = Record<string, unknown>;

// A combobox of the items of a `createItems()` collection. With `inputInPopup`, the trigger is the
// control and shows the label of the value.
defineProps({
  items: { type: Object as PropType<unknown>, required: true },
  root: Object as PropType<Props>,
  inputInPopup: Boolean,
});
</script>

<template>
  <Combobox.Root :items="items as any" v-bind="root">
    <Combobox.Trigger v-if="inputInPopup" data-testid="trigger">
      <Combobox.Value placeholder="None" />
    </Combobox.Trigger>
    <Combobox.Input v-else data-testid="input" />
    <Combobox.Portal>
      <Combobox.Positioner>
        <Combobox.Popup data-testid="popup">
          <Combobox.Input v-if="inputInPopup" data-testid="input" />
          <Combobox.List>
            <template #item="{ item }">
              <Combobox.Item :value="(item as any).id" :data-testid="`item-${(item as any).id}`">
                {{ (item as any).name }}
              </Combobox.Item>
            </template>
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
</template>
