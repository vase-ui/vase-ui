<script setup lang="ts">
import { Menu } from '@vase-ui/vue/menu';
</script>

<template>
  <Menu.Root>
    <Menu.Trigger>Actions</Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner>
        <Menu.Popup>
          <!-- Close the menu when a checkbox item is clicked -->
          <Menu.CheckboxItem close-on-click>Pin</Menu.CheckboxItem>

          <!-- Keep the menu open when an item is clicked -->
          <Menu.Item :close-on-click="false">Refresh</Menu.Item>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
</template>
