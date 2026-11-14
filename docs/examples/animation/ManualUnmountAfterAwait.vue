<script setup lang="ts">
import { shallowRef } from 'vue';
import { Popover } from '@vase-ui/vue/popover';

declare function save(): Promise<void>;

const open = shallowRef(false);

// #region listener
async function handleOpenChange(nextOpen: boolean, details: Popover.Root.ChangeEventDetails) {
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
  <Popover.Root :open="open" @open-change="handleOpenChange">
    <!-- ... -->
  </Popover.Root>
</template>
