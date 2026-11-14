<script setup lang="ts">
import DialogPopupPart from '../../../test/fixtures/DialogPopupPart.vue';
import * as Dialog from '../index.parts';

defineProps<{ first: boolean }>();
</script>

<template>
  <Dialog.Root default-open :modal="false">
    <DialogPopupPart>
      <Dialog.Title v-if="!first">Title 2</Dialog.Title>
      <Dialog.Title v-if="first">Title 1</Dialog.Title>
    </DialogPopupPart>
  </Dialog.Root>
</template>
