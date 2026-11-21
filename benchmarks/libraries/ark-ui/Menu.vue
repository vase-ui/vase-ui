<script setup lang="ts">
import { Menu } from '@ark-ui/vue/menu';
</script>

<template>
  <Menu.Root>
    <Menu.Trigger data-bench="trigger">Open</Menu.Trigger>
    <Menu.Positioner>
      <Menu.Content data-bench="popup">
        <Menu.Item value="item-1">Item 1</Menu.Item>
        <Menu.Item value="item-2">Item 2</Menu.Item>
        <Menu.Item value="item-3">Item 3</Menu.Item>
        <Menu.Item value="item-4">Item 4</Menu.Item>
        <Menu.Item value="item-5">Item 5</Menu.Item>
      </Menu.Content>
    </Menu.Positioner>
  </Menu.Root>
</template>
