<script setup lang="ts">
import { Dialog, DialogDescription, DialogPanel, DialogTitle } from '@headlessui/vue';
import { ref } from 'vue';

const isOpen = ref(false);
</script>

<template>
  <button type="button" data-bench="trigger" @click="isOpen = true">Open</button>
  <Dialog :open="isOpen" @close="isOpen = false">
    <DialogPanel data-bench="popup">
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
      <button type="button" @click="isOpen = false">Close</button>
    </DialogPanel>
  </Dialog>
</template>
