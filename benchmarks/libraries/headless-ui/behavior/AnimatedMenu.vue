<script setup lang="ts">
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import '../../../behavior/style.css';
</script>

<template>
  <div class="bench-page">
    <Menu>
      <MenuButton data-bench="trigger">Open</MenuButton>
      <Transition
        enter-active-class="bench-motion"
        leave-active-class="bench-motion"
        enter-from-class="bench-hidden"
        leave-to-class="bench-hidden"
      >
        <MenuItems data-bench="popup">
          <MenuItem><button type="button">Item 1</button></MenuItem>
          <MenuItem><button type="button">Item 2</button></MenuItem>
          <MenuItem><button type="button">Item 3</button></MenuItem>
          <MenuItem><button type="button">Item 4</button></MenuItem>
          <MenuItem><button type="button">Item 5</button></MenuItem>
        </MenuItems>
      </Transition>
    </Menu>
  </div>
</template>
