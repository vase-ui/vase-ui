<script setup lang="ts">
import { shallowRef, type PropType } from 'vue';
import { Combobox } from '../../src/combobox';
import { Dialog } from '../../src/dialog';

type Props = Record<string, unknown>;

// An inline combobox in a dialog, with one open state for both. A pick closes the dialog unless
// `keepOpen` is set. With `keepMounted`, the closed dialog stays in the DOM.
const props = defineProps({
  root: Object as PropType<Props>,
  items: { type: Array as PropType<string[]>, default: () => ['Apple', 'Banana', 'Cherry'] },
  keepMounted: Boolean,
  keepOpen: Boolean,
});
const open = shallowRef(false);
function onValueChange() {
  if (!props.keepOpen) open.value = false;
}
</script>

<template>
  <Dialog.Root v-model:open="open">
    <Dialog.Trigger data-testid="trigger">Choose fruit</Dialog.Trigger>
    <Dialog.Portal :keep-mounted="keepMounted">
      <Dialog.Popup
        data-testid="dialog"
        aria-label="Fruit chooser"
        style="position: relative; z-index: 1"
      >
        <Combobox.Root
          v-model:open="open"
          inline
          :items="items"
          v-bind="root"
          @value-change="onValueChange"
        >
          <Combobox.Input data-testid="input" aria-label="Fruit" />
          <Combobox.List data-testid="list">
            <template #item="{ item }">
              <Combobox.Item :value="item" :data-testid="`item-${item}`">{{ item }}</Combobox.Item>
            </template>
          </Combobox.List>
        </Combobox.Root>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
</template>
