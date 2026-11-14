<script setup lang="ts">
import { Menu } from '@vase-ui/vue/menu';
</script>

<template>
  <Menu.Root>
    <Menu.Trigger>Row actions</Menu.Trigger>
    <Menu.Trigger>Quick actions</Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner>
        <Menu.Popup>
          <Menu.Item>Edit</Menu.Item>
          <Menu.Item>Share</Menu.Item>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
</template>
