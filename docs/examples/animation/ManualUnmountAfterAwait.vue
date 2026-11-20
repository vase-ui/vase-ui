<script setup lang="ts">
import { shallowRef } from 'vue';
import { Drawer } from '@vase-ui/vue/drawer';

declare function save(): Promise<void>;

const open = shallowRef(false);

// #region listener
async function handleOpenChange(nextOpen: boolean, details: Drawer.Root.ChangeEventDetails) {
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
  <Drawer.Root :open="open" @open-change="handleOpenChange">
    <!-- ... -->
  </Drawer.Root>
</template>
