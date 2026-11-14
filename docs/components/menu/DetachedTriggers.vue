<script setup lang="ts">
import { Menu } from '@vase-ui/vue/menu';

const demoMenu = Menu.createHandle();
</script>

<template>
  <Menu.Trigger :handle="demoMenu">Actions</Menu.Trigger>

  <Menu.Root :handle="demoMenu">
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
