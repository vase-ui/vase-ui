<script setup lang="ts">
import { Menu } from '@vase-ui/vue/menu';
</script>

<template>
  <!-- Close the menu when a checkbox item is clicked -->
  <Menu.CheckboxItem close-on-click />

  <!-- Keep the menu open when an item is clicked -->
  <Menu.Item :close-on-click="false" />
</template>
