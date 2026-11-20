<script setup lang="ts">
import { Dialog } from '../../src/dialog';
import { NavigationMenu } from '../../src/navigation-menu';

// A dialog in the content of a menu.
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
              <Dialog.Popup data-testid="dialog-popup">
                <button type="button" data-testid="dialog-button">Dialog button</button>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
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
