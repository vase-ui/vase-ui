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

const isOpen1 = ref(false);
const isOpen2 = ref(false);
const pageCount = ref(0);
const dialogCount = ref(0);
</script>

<template>
  <div class="bench-page">
    <button type="button" data-bench="page-action" @click="pageCount++">Page action</button>
    <span data-bench="page-count">{{ pageCount }}</span>
    <button type="button" data-bench="dialog-1-trigger" @click="isOpen1 = true">
      Open dialog 1
    </button>
  </div>
  <TransitionRoot :show="isOpen1" as="template">
    <Dialog @close="isOpen1 = false">
      <div class="bench-backdrop" aria-hidden="true" />
      <TransitionChild
        class="bench-layer bench-motion"
        enter-from="bench-hidden"
        leave-to="bench-hidden"
      >
        <DialogPanel data-bench="dialog-1">
          <div class="bench-corner">
            <button type="button" data-bench="dialog-1-action" @click="dialogCount++">
              Dialog 1 action
            </button>
            <span data-bench="dialog-1-count">{{ dialogCount }}</span>
          </div>
          <DialogTitle>Dialog 1</DialogTitle>
          <DialogDescription>Description 1</DialogDescription>
          <button type="button" data-bench="dialog-2-trigger" @click="isOpen2 = true">
            Open dialog 2
          </button>
          <TransitionRoot :show="isOpen2" as="template">
            <Dialog @close="isOpen2 = false">
              <div class="bench-backdrop" aria-hidden="true" />
              <TransitionChild
                class="bench-layer bench-motion"
                enter-from="bench-hidden"
                leave-to="bench-hidden"
              >
                <DialogPanel data-bench="dialog-2">
                  <DialogTitle>Dialog 2</DialogTitle>
                  <DialogDescription>Description 2</DialogDescription>
                  <button type="button" data-bench="dialog-2-action">Dialog 2 action</button>
                  <button type="button" @click="isOpen2 = false">Close</button>
                </DialogPanel>
              </TransitionChild>
            </Dialog>
          </TransitionRoot>
          <button type="button" @click="isOpen1 = false">Close</button>
        </DialogPanel>
      </TransitionChild>
    </Dialog>
  </TransitionRoot>
</template>
