<script setup lang="ts">
import { Dialog } from '@vase-ui/vue/dialog';
</script>

<template>
  <Dialog.Root default-open>
    <Dialog.Portal>
      <Dialog.Popup />
    </Dialog.Portal>
  </Dialog.Root>
</template>
