<script setup lang="ts">
import { Dialog } from '../../src/dialog';
import { NavigationMenu } from '../../src/navigation-menu';
import { Popover } from '../../src/popover';

// A dialog and a popover in the content of a menu. The dialog popup is positioned, so it is above
// the fixed element of its modal layer.
</script>

<template>
  <NavigationMenu.Root :delay="0">
    <NavigationMenu.List>
      <NavigationMenu.Item value="menu">
        <NavigationMenu.Trigger data-testid="trigger">Menu</NavigationMenu.Trigger>
        <NavigationMenu.Content data-testid="content">
          <Dialog.Root>
            <Dialog.Trigger data-testid="dialog-trigger">Open dialog</Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Popup data-testid="dialog-popup" style="position: relative">
                <button type="button" data-testid="dialog-button">Dialog button</button>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
          <Popover.Root>
            <Popover.Trigger data-testid="popover-trigger">Open popover</Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup data-testid="popover-popup">
                  <button type="button" data-testid="popover-button">Popover button</button>
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        </NavigationMenu.Content>
      </NavigationMenu.Item>
    </NavigationMenu.List>
    <NavigationMenu.Portal>
      <NavigationMenu.Positioner data-testid="positioner">
        <NavigationMenu.Popup data-testid="popup">
          <NavigationMenu.Viewport />
        </NavigationMenu.Popup>
      </NavigationMenu.Positioner>
    </NavigationMenu.Portal>
  </NavigationMenu.Root>
</template>
