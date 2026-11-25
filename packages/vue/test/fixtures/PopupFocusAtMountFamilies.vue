<script setup lang="ts">
import type { PropType } from 'vue';
import { Combobox } from '../../src/combobox';
import { Dialog } from '../../src/dialog';
import { Drawer } from '../../src/drawer';
import { Menu } from '../../src/menu';
import { NavigationMenu } from '../../src/navigation-menu';
import { Popover } from '../../src/popover';
import { PreviewCard } from '../../src/preview-card';
import { Tooltip } from '../../src/tooltip';
import PopupFocusAtMount from './PopupFocusAtMount.vue';

// One popup of a family, closed, with its trigger. Its content is an input that takes the focus at
// its mount. A tooltip and a preview card open at the hover of their trigger with no delay.
defineProps({
  family: {
    type: String as PropType<
      | 'dialog'
      | 'drawer'
      | 'popover'
      | 'menu'
      | 'tooltip'
      | 'preview-card'
      | 'combobox'
      | 'navigation-menu'
    >,
    required: true,
  },
  mode: { type: String as PropType<'onMounted' | 'directive'>, required: true },
  log: {
    type: Object as PropType<{ add(entry: { focused: boolean; shown: boolean }): void }>,
    required: true,
  },
});
</script>

<template>
  <Dialog.Root v-if="family === 'dialog'">
    <Dialog.Trigger data-testid="trigger">Open</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Popup data-testid="popup">
        <PopupFocusAtMount :mode :log />
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
  <Drawer.Root v-else-if="family === 'drawer'">
    <Drawer.Trigger data-testid="trigger">Open</Drawer.Trigger>
    <Drawer.Portal>
      <Drawer.Viewport>
        <Drawer.Popup data-testid="popup">
          <PopupFocusAtMount :mode :log />
        </Drawer.Popup>
      </Drawer.Viewport>
    </Drawer.Portal>
  </Drawer.Root>
  <Popover.Root v-else-if="family === 'popover'">
    <Popover.Trigger data-testid="trigger">Open</Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner>
        <Popover.Popup data-testid="popup">
          <PopupFocusAtMount :mode :log />
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
  <Menu.Root v-else-if="family === 'menu'">
    <Menu.Trigger data-testid="trigger">Open</Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner>
        <Menu.Popup data-testid="popup">
          <PopupFocusAtMount :mode :log />
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
  <Tooltip.Root v-else-if="family === 'tooltip'">
    <Tooltip.Trigger data-testid="trigger" :delay="0">Open</Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Positioner>
        <Tooltip.Popup data-testid="popup">
          <PopupFocusAtMount :mode :log />
        </Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  </Tooltip.Root>
  <PreviewCard.Root v-else-if="family === 'preview-card'">
    <PreviewCard.Trigger data-testid="trigger" href="#" :delay="0">Open</PreviewCard.Trigger>
    <PreviewCard.Portal>
      <PreviewCard.Positioner>
        <PreviewCard.Popup data-testid="popup">
          <PopupFocusAtMount :mode :log />
        </PreviewCard.Popup>
      </PreviewCard.Positioner>
    </PreviewCard.Portal>
  </PreviewCard.Root>
  <Combobox.Root v-else-if="family === 'combobox'" :items="['Item']">
    <Combobox.Input aria-label="Combobox" />
    <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
    <Combobox.Portal>
      <Combobox.Positioner>
        <Combobox.Popup data-testid="popup">
          <PopupFocusAtMount :mode :log />
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
  <NavigationMenu.Root v-else>
    <NavigationMenu.List>
      <NavigationMenu.Item value="one">
        <NavigationMenu.Trigger data-testid="trigger">One</NavigationMenu.Trigger>
        <NavigationMenu.Content>NavigationMenu</NavigationMenu.Content>
      </NavigationMenu.Item>
    </NavigationMenu.List>
    <NavigationMenu.Portal>
      <NavigationMenu.Positioner>
        <NavigationMenu.Popup data-testid="popup">
          <PopupFocusAtMount :mode :log />
          <NavigationMenu.Viewport />
        </NavigationMenu.Popup>
      </NavigationMenu.Positioner>
    </NavigationMenu.Portal>
  </NavigationMenu.Root>
</template>
