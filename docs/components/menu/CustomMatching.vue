<script setup lang="ts">
import { Menu } from '@vase-ui/vue/menu';

const { startsWith } = Menu.useFilter();
</script>

<template>
  <Menu.FilterProvider :filter="startsWith">
    <Menu.Root>
      <!-- Menu parts -->
    </Menu.Root>
  </Menu.FilterProvider>
</template>
