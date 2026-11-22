<script setup lang="ts">
import type { PropType } from 'vue';
import { Combobox } from '../../src/combobox';
import { Menu } from '../../src/menu';
import { Popover } from '../../src/popover';

// An open popover whose popup holds a menu between two buttons, or a combobox alone. An input
// follows the trigger of the popover. `to` is the container of each portal.
defineProps({
  nested: { type: String as PropType<'menu' | 'combobox'>, required: true },
  to: Object as PropType<HTMLElement>,
});
</script>

<template>
  <Popover.Root default-open>
    <Popover.Trigger data-testid="popover-trigger">Popover</Popover.Trigger>
    <input data-testid="after-trigger" aria-label="After the trigger" />
    <Popover.Portal :to>
      <Popover.Positioner>
        <Popover.Popup data-testid="popover-popup">
          <button v-if="nested === 'menu'" data-testid="before">Before</button>
          <Menu.Root v-if="nested === 'menu'">
            <Menu.Trigger data-testid="menu-trigger">Menu</Menu.Trigger>
            <Menu.Portal :to>
              <Menu.Positioner>
                <Menu.Popup data-testid="menu-popup">
                  <Menu.Item data-testid="item" :close-on-click="false">Item</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <Combobox.Root v-else :items="['Apple', 'Banana', 'Cherry']">
            <Combobox.Input data-testid="combobox-input" aria-label="Fruit" />
            <Combobox.Portal :to>
              <Combobox.Positioner>
                <Combobox.Popup data-testid="combobox-popup">
                  <Combobox.List>
                    <template #item="{ item }">
                      <Combobox.Item :value="item">{{ item }}</Combobox.Item>
                    </template>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
          <button v-if="nested === 'menu'" data-testid="after">After</button>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
</template>
