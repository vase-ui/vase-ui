<script setup lang="ts">
import { ref, useTemplateRef, type PropType } from 'vue';
import { Dialog } from '../../src/dialog';
import { Menu } from '../../src/menu';
import PopupContentOnMounted from './PopupContentOnMounted.vue';
import type { PopupContentReading } from './popupContent';

// Modes:
// - `v-model`: a button outside opens a dialog through `v-model:open`, with a trigger present.
// - `default-open`: a button mounts a dialog with `default-open` while that button holds focus.
// - `initial-focus`: a dialog with an `initialFocus` function that returns a button before the
//   child that focuses itself at mount.
// - `menu-arrow`: a menu whose content focuses a field at mount, opened with `ArrowDown`.
defineProps({
  mode: {
    type: String as PropType<'v-model' | 'default-open' | 'initial-focus' | 'menu-arrow'>,
    default: 'v-model',
  },
  log: { type: Object as PropType<{ add(entry: PopupContentReading): void }>, required: true },
  onInitialFocus: Function as PropType<() => void>,
});
const open = ref(false);
const mounted = ref(false);
const first = useTemplateRef<HTMLButtonElement>('first');
</script>

<template>
  <template v-if="mode === 'default-open'">
    <button type="button" data-testid="opener" @click="mounted = true">Open</button>
    <Dialog.Root v-if="mounted" default-open>
      <Dialog.Portal>
        <Dialog.Popup data-testid="popup">
          <button type="button" data-testid="first">First</button>
          <PopupContentOnMounted :log />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  </template>
  <template v-else-if="mode === 'initial-focus'">
    <Dialog.Root>
      <Dialog.Trigger data-testid="trigger">Open</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Popup
          data-testid="popup"
          :initial-focus="
            () => {
              onInitialFocus?.();
              return first;
            }
          "
        >
          <button ref="first" type="button" data-testid="first">First</button>
          <PopupContentOnMounted :log />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  </template>
  <template v-else-if="mode === 'menu-arrow'">
    <Menu.Root>
      <Menu.Trigger data-testid="trigger">Open</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner data-testid="positioner">
          <Menu.Popup data-testid="popup">
            <PopupContentOnMounted :log />
            <Menu.Item data-testid="item-1">Item 1</Menu.Item>
            <Menu.Item data-testid="item-2">Item 2</Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  </template>
  <template v-else>
    <button type="button" data-testid="opener" @click="open = true">Open</button>
    <Dialog.Root v-model:open="open">
      <Dialog.Trigger data-testid="trigger">Trigger</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Popup data-testid="popup">
          <button type="button" data-testid="first">First</button>
          <PopupContentOnMounted :log />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  </template>
</template>
