<script setup lang="ts">
import { Menu } from '@vase-ui/vue/menu';
import { Menubar } from '@vase-ui/vue/menubar';
</script>

<template>
  <main>
    <Menubar data-testid="menubar">
      <Menu.Root>
        <Menu.Trigger data-testid="file">File</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="file-popup">
              <Menu.Item>New</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <Menu.Root>
        <Menu.Trigger data-testid="edit">Edit</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="edit-popup">
              <Menu.Item>Cut</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </Menubar>
  </main>
</template>
