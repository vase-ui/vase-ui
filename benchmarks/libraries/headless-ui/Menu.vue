<script setup lang="ts">
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
</script>

<template>
  <Menu>
    <MenuButton data-bench="trigger">Open</MenuButton>
    <MenuItems data-bench="popup">
      <MenuItem><button type="button">Item 1</button></MenuItem>
      <MenuItem><button type="button">Item 2</button></MenuItem>
      <MenuItem><button type="button">Item 3</button></MenuItem>
      <MenuItem><button type="button">Item 4</button></MenuItem>
      <MenuItem><button type="button">Item 5</button></MenuItem>
    </MenuItems>
  </Menu>
</template>
