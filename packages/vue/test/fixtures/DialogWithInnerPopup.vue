<script setup lang="ts">
import type { PropType } from 'vue';
import { Combobox } from '../../src/combobox';
import { Dialog } from '../../src/dialog';
import { Menu } from '../../src/menu';
import { Popover } from '../../src/popover';
import { Select } from '../../src/select';

// An open modal dialog with the popup of `inner` in its popup: a select, a menu, a modal popover,
// a modal combobox or a nested dialog. The viewport of the dialog takes no press. A test gives the
// z-index of each layer with a style sheet. The popup of the dialog has a button that logs each
// click, and the trigger of the inner popup. The log has each change of an open state.
defineProps({
  inner: {
    type: String as PropType<'select' | 'menu' | 'popover' | 'combobox' | 'dialog'>,
    required: true,
  },
  log: { type: Object as PropType<{ add(entry: string): void }>, required: true },
});
const FIXED = 'position: fixed; inset: 0';
const VIEWPORT = `${FIXED}; pointer-events: none`;
const POPUP =
  'position: fixed; left: 20px; top: 40px; width: 300px; height: 200px; pointer-events: auto';
const BUTTON = 'position: absolute; left: 10px; top: 10px';
const TRIGGER = 'position: absolute; left: 10px; top: 150px';
const INNER_POPUP = 'position: fixed; left: 60px; top: 100px; pointer-events: auto';
</script>

<template>
  <Dialog.Root
    default-open
    @open-change="(open: boolean, details) => log.add(`dialog ${open} ${details.reason}`)"
  >
    <Dialog.Portal>
      <Dialog.Backdrop data-testid="backdrop" :style="FIXED" />
      <Dialog.Viewport data-testid="viewport" :style="VIEWPORT">
        <Dialog.Popup data-testid="dialog" :style="POPUP">
          <button data-testid="button" :style="BUTTON" @click="log.add('click')">Button</button>
          <Select.Root
            v-if="inner === 'select'"
            @open-change="(open: boolean, details) => log.add(`select ${open} ${details.reason}`)"
          >
            <Select.Trigger data-testid="trigger" :style="TRIGGER">
              <Select.Value placeholder="Fruit" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner data-testid="positioner" :align-item-with-trigger="false">
                <Select.Popup data-testid="popup">
                  <Select.Item value="apple">Apple</Select.Item>
                  <Select.Item value="banana">Banana</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <Menu.Root
            v-else-if="inner === 'menu'"
            @open-change="(open: boolean, details) => log.add(`menu ${open} ${details.reason}`)"
          >
            <Menu.Trigger data-testid="trigger" :style="TRIGGER">Menu</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner data-testid="positioner">
                <Menu.Popup data-testid="popup">
                  <Menu.Item>Apple</Menu.Item>
                  <Menu.Item>Banana</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <Popover.Root
            v-else-if="inner === 'popover'"
            modal
            @open-change="(open: boolean, details) => log.add(`popover ${open} ${details.reason}`)"
          >
            <Popover.Trigger data-testid="trigger" :style="TRIGGER">Popover</Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner data-testid="positioner">
                <Popover.Popup data-testid="popup">Popover</Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
          <Combobox.Root
            v-else-if="inner === 'combobox'"
            modal
            :items="['Apple', 'Banana']"
            @open-change="(open: boolean, details) => log.add(`combobox ${open} ${details.reason}`)"
          >
            <Combobox.Input data-testid="trigger" aria-label="Fruit" :style="TRIGGER" />
            <Combobox.Portal>
              <Combobox.Positioner data-testid="positioner">
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
          <Dialog.Root
            v-else
            @open-change="(open: boolean, details) => log.add(`nested ${open} ${details.reason}`)"
          >
            <Dialog.Trigger data-testid="trigger" :style="TRIGGER">Nested</Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Backdrop data-testid="nested-backdrop" :style="FIXED" />
              <Dialog.Viewport data-testid="nested-viewport" :style="VIEWPORT">
                <Dialog.Popup data-testid="popup" :style="INNER_POPUP">Nested</Dialog.Popup>
              </Dialog.Viewport>
            </Dialog.Portal>
          </Dialog.Root>
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>
</template>
