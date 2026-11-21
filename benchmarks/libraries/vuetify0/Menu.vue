<script setup lang="ts">
import { Menu } from '@vuetify/v0';
</script>

<template>
  <Menu.Root>
    <Menu.Activator data-bench="trigger">Open</Menu.Activator>
    <Menu.Content data-bench="popup">
      <Menu.Item>Item 1</Menu.Item>
      <Menu.Item>Item 2</Menu.Item>
      <Menu.Item>Item 3</Menu.Item>
      <Menu.Item>Item 4</Menu.Item>
      <Menu.Item>Item 5</Menu.Item>
    </Menu.Content>
  </Menu.Root>
</template>
