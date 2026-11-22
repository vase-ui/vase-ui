<script setup lang="ts">
import { ref } from 'vue';
import { Menu } from '../../src/menu';
import { Popover } from '../../src/popover';
import { Select } from '../../src/select';

// A popover, open at the mount, with a button that opens a select or a menu through `v-model:open`.
defineProps<{ family: 'select' | 'menu' }>();
const open = ref(false);
</script>

<template>
  <Popover.Root default-open>
    <Popover.Trigger>Popover</Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner>
        <Popover.Popup data-testid="popover-popup">
          <button type="button" data-testid="opener" @click="open = true">Open</button>
          <Select.Root v-if="family === 'select'" v-model:open="open">
            <Select.Trigger data-testid="trigger"
              ><Select.Value placeholder="Pick"
            /></Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup data-testid="popup">
                  <Select.Item value="one">One</Select.Item>
                  <Select.Item value="two" data-testid="two">Two</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <Menu.Root v-else v-model:open="open">
            <Menu.Trigger data-testid="trigger">Menu</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup data-testid="popup">
                  <Menu.Item>One</Menu.Item>
                  <Menu.Item data-testid="two">Two</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
</template>
