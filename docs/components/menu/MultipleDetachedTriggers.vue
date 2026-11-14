<script setup lang="ts">
import { Menu } from '@vase-ui/vue/menu';

const projectMenu = Menu.createHandle();
</script>

<template>
  <Menu.Trigger :handle="projectMenu">Row actions</Menu.Trigger>

  <Menu.Trigger :handle="projectMenu">Quick actions</Menu.Trigger>

  <Menu.Root :handle="projectMenu">
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
