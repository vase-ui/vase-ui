<script setup lang="ts">
import { Dialog } from '@vase-ui/vue/dialog';
import { ref } from 'vue';
import '../../../behavior/style.css';

const pageCount = ref(0);
const dialogCount = ref(0);
</script>

<template>
  <div class="bench-page">
    <button type="button" data-bench="page-action" @click="pageCount++">Page action</button>
    <span data-bench="page-count">{{ pageCount }}</span>
    <Dialog.Root>
      <Dialog.Trigger data-bench="dialog-1-trigger">Open dialog 1</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop class="bench-backdrop" />
        <Transition enter-from-class="bench-hidden" leave-to-class="bench-hidden" appear>
          <Dialog.Popup data-bench="dialog-1" class="bench-motion">
            <div class="bench-corner">
              <button type="button" data-bench="dialog-1-action" @click="dialogCount++">
                Dialog 1 action
              </button>
              <span data-bench="dialog-1-count">{{ dialogCount }}</span>
            </div>
            <Dialog.Title>Dialog 1</Dialog.Title>
            <Dialog.Description>Description 1</Dialog.Description>
            <Dialog.Root>
              <Dialog.Trigger data-bench="dialog-2-trigger">Open dialog 2</Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Backdrop class="bench-backdrop" />
                <Transition enter-from-class="bench-hidden" leave-to-class="bench-hidden" appear>
                  <Dialog.Popup data-bench="dialog-2" class="bench-motion">
                    <Dialog.Title>Dialog 2</Dialog.Title>
                    <Dialog.Description>Description 2</Dialog.Description>
                    <button type="button" data-bench="dialog-2-action">Dialog 2 action</button>
                    <Dialog.Close>Close</Dialog.Close>
                  </Dialog.Popup>
                </Transition>
              </Dialog.Portal>
            </Dialog.Root>
            <Dialog.Close>Close</Dialog.Close>
          </Dialog.Popup>
        </Transition>
      </Dialog.Portal>
    </Dialog.Root>
  </div>
</template>
