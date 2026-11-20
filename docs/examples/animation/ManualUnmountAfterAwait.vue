<script setup lang="ts">
import { shallowRef } from 'vue';
import { Menu } from '@vase-ui/vue/menu';

declare function save(): Promise<void>;

const open = shallowRef(false);

// #region listener
async function handleOpenChange(nextOpen: boolean, details: Menu.Root.ChangeEventDetails) {
  if (nextOpen) {
    open.value = true;
    return;
  }
  await save();
  details.preventUnmountOnClose();
  open.value = false;
}
// #endregion listener
</script>

<template>
  <Menu.Root :open="open" @open-change="handleOpenChange">
    <!-- ... -->
  </Menu.Root>
</template>
