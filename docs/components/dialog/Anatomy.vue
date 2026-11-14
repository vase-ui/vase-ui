<script setup lang="ts">
import { Dialog } from '@vase-ui/vue/dialog';
</script>

<template>
  <Dialog.Root>
    <Dialog.Trigger />
    <Dialog.Portal>
      <Dialog.Backdrop />
      <Dialog.Viewport>
        <Dialog.Popup>
          <Dialog.Title />
          <Dialog.Description />
          <Dialog.Close />
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>
</template>
