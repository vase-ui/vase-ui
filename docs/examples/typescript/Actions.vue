<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { Menu } from '@vase-ui/vue/menu';

const menu = useTemplateRef('menu');

function close() {
  menu.value?.close();
}
</script>

<template>
  <button type="button" @click="close">Close the menu</button>
  <Menu.Root ref="menu">
    <Menu.Trigger>Trigger</Menu.Trigger>
  </Menu.Root>
</template>
