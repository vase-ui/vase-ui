<script setup lang="ts">
import * as Dialog from '../index.parts';
</script>

<template>
  <Dialog.Root default-open>
    <Dialog.Portal>
      <Dialog.Popup />
    </Dialog.Portal>
  </Dialog.Root>
</template>
