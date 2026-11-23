<script setup lang="ts">
import {
  Dialog,
  DialogDescription,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
} from '@headlessui/vue';
import { ref } from 'vue';
import '../../../behavior/style.css';

const isOpen = ref(false);
</script>

<template>
  <div class="bench-page">
    <button type="button" data-bench="trigger" @click="isOpen = true">Open</button>
  </div>
  <TransitionRoot :show="isOpen" as="template">
    <Dialog @close="isOpen = false">
      <TransitionChild
        data-bench="popup"
        enter="bench-motion"
        enter-from="bench-hidden"
        leave="bench-motion"
        leave-to="bench-hidden"
      >
        <DialogPanel>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Description</DialogDescription>
          <button type="button" @click="isOpen = false">Close</button>
        </DialogPanel>
      </TransitionChild>
    </Dialog>
  </TransitionRoot>
</template>
