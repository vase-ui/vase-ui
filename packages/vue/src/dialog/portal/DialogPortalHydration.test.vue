<script setup lang="ts">
import DialogPopupPart from '../../../test/fixtures/DialogPopupPart.vue';
import * as Dialog from '../index.parts';
</script>

<template>
  <Dialog.Root default-open>
    <Dialog.Portal>
      <DialogPopupPart />
    </Dialog.Portal>
  </Dialog.Root>
</template>
