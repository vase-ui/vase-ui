<script setup lang="ts">
import { Dialog } from '@vase-ui/vue/dialog';
import { Menu } from '@vase-ui/vue/menu';
import { Tooltip } from '@vase-ui/vue/tooltip';
import MyButton from './MyButton.vue';
</script>

<template>
  <Dialog.Root>
    <Tooltip.Root>
      <Menu.Root>
        <Menu.Trigger>
          <template #element="{ props: menuTrigger, elementRef }">
            <Tooltip.Trigger v-bind="menuTrigger" :ref="elementRef">
              <template #render="{ props: tooltipTrigger }">
                <Dialog.Trigger v-bind="tooltipTrigger">
                  <template #render="{ props: dialogTrigger }">
                    <MyButton v-bind="dialogTrigger" size="md">Open menu</MyButton>
                  </template>
                </Dialog.Trigger>
              </template>
            </Tooltip.Trigger>
          </template>
        </Menu.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup>Opens a menu and a dialog</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item>Add to Library</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </Tooltip.Root>
    <Dialog.Portal>
      <Dialog.Popup>
        <Dialog.Title>Dialog</Dialog.Title>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
</template>
