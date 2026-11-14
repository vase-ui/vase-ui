<script setup lang="ts">
import { Menu } from '@vase-ui/vue/menu';
</script>

<template>
  <Menu.Root>
    <Menu.Trigger>Actions</Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner>
        <Menu.Popup>
          <Menu.LinkItem href="/projects">Go to Projects</Menu.LinkItem>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
</template>
