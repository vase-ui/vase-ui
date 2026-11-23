<script setup lang="ts">
import { Dialog } from '@vase-ui/vue/dialog';
import '../../../behavior/style.css';
</script>

<template>
  <div class="bench-page">
    <Dialog.Root>
      <Dialog.Trigger data-bench="trigger">Open</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Viewport>
          <Transition enter-from-class="bench-hidden" leave-to-class="bench-hidden">
            <Dialog.Popup data-bench="popup" class="bench-motion">
              <Dialog.Title>Title</Dialog.Title>
              <Dialog.Description>Description</Dialog.Description>
              <Dialog.Close>Close</Dialog.Close>
            </Dialog.Popup>
          </Transition>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  </div>
</template>
