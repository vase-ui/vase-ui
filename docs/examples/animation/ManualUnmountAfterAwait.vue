<script setup lang="ts">
import { shallowRef } from 'vue';
import { Dialog } from '@vase-ui/vue/dialog';

declare function save(): Promise<void>;

const open = shallowRef(false);

// #region listener
async function handleOpenChange(nextOpen: boolean, details: Dialog.Root.ChangeEventDetails) {
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
  <Dialog.Root :open="open" @open-change="handleOpenChange">
    <!-- ... -->
  </Dialog.Root>
</template>
