<script setup lang="ts">
import { Menu } from '@vase-ui/vue/menu';
import MyButton from './MyButton.vue';
</script>

<template>
  <Menu.Root>
    <Menu.Trigger>
      <template #element="{ props, elementRef }">
        <MyButton v-bind="props" :ref="elementRef" size="md">Open menu</MyButton>
      </template>
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner>
        <Menu.Popup>
          <Menu.Item>Add to Library</Menu.Item>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
</template>
