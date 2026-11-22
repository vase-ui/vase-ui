<script setup lang="ts">
import type { PropType } from 'vue';
import { Combobox } from '../../src/combobox';

type Props = Record<string, unknown>;

// A combobox whose popup is in a `<Transition>` with a leave of 400 ms. With `inputInPopup`, the
// trigger is the control and shows the value, and the input is in the popup; else a trigger is
// after the input. `log` gets `after-leave` at the end of each leave.
defineProps({
  root: Object as PropType<Props>,
  items: { type: Array as PropType<unknown[]>, default: () => ['apple', 'apricot', 'banana'] },
  inputInPopup: Boolean,
  log: { type: Object as PropType<{ add(entry: string): void }>, default: () => ({ add() {} }) },
});
</script>

<template>
  <Combobox.Root :items="items" v-bind="root">
    <Combobox.Trigger v-if="inputInPopup" data-testid="trigger"
      ><Combobox.Value
    /></Combobox.Trigger>
    <template v-else>
      <Combobox.Input data-testid="input" />
      <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
    </template>
    <Combobox.Portal>
      <Combobox.Positioner>
        <Transition name="combobox-leave" @after-leave="log.add('after-leave')">
          <Combobox.Popup data-testid="popup">
            <Combobox.Input v-if="inputInPopup" data-testid="input" />
            <Combobox.Empty>No match.</Combobox.Empty>
            <Combobox.List>
              <template #item="{ item }">
                <Combobox.Item :value="item" :data-testid="`item-${item}`">{{
                  item
                }}</Combobox.Item>
              </template>
            </Combobox.List>
          </Combobox.Popup>
        </Transition>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
</template>

<style>
.combobox-leave-leave-active {
  transition: opacity 400ms linear;
}
.combobox-leave-leave-to {
  opacity: 0;
}
</style>
