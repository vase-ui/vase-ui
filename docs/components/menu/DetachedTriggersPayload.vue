<script setup lang="ts">
import { Menu } from '@vase-ui/vue/menu';

const menus = {
  file: ['New', 'Open', 'Save'],
  edit: ['Undo', 'Redo', 'Cut', 'Copy', 'Paste'],
};

const demoMenu = Menu.createHandle<{ items: string[] }>();
</script>

<template>
  <Menu.Trigger :handle="demoMenu" :payload="{ items: menus.file }">File</Menu.Trigger>

  <Menu.Trigger :handle="demoMenu" :payload="{ items: menus.edit }">Edit</Menu.Trigger>

  <Menu.Root v-slot="{ payload }" :handle="demoMenu">
    <Menu.Portal>
      <Menu.Positioner>
        <Menu.Popup>
          <Menu.Viewport>
            <Menu.Item v-for="item in payload?.items ?? []" :key="item">{{ item }}</Menu.Item>
          </Menu.Viewport>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
</template>
