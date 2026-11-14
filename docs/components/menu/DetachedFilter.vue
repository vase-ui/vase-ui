<script setup lang="ts">
import { Menu } from '@vase-ui/vue/menu';

const handle = Menu.createHandle();
</script>

<template>
  <Menu.Trigger :handle="handle">Actions</Menu.Trigger>

  <Menu.FilterProvider>
    <Menu.Root :handle="handle">
      <!-- Menu parts -->
    </Menu.Root>
  </Menu.FilterProvider>
</template>
