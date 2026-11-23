<script setup lang="ts">
import { Toast, Toaster, createToaster } from '@ark-ui/vue/toast';
import { toastTimeout } from '../../../harness/toastTimeout.ts';
import '../../../behavior/style.css';
import '../../../behavior/toasts.css';

const toaster = createToaster({ placement: 'bottom-end', overlap: true, gap: 16, offsets: '32px' });

// The docs give no option for a toast of high priority, so the two buttons add the same toast.
function addToast() {
  toaster.create({
    title: 'Saved',
    description: 'The file is saved.',
    duration: toastTimeout,
    action: { label: 'Undo', onClick: () => {} },
  });
}
</script>

<template>
  <div class="bench-page">
    <button type="button" data-bench="add-toast" @click="addToast">Add toast</button>
    <button type="button" data-bench="add-important-toast" @click="addToast">
      Add important toast
    </button>
  </div>
  <Teleport to="body">
    <!-- The types of `Toaster` in the package have no props, so the prop goes in through `v-bind`. -->
    <Toaster v-slot="toast" v-bind="{ toaster }">
      <Toast.Root class="bench-toast" data-bench="toast">
        <div class="bench-toast-content">
          <div class="bench-toast-text">
            <Toast.Title class="bench-toast-title">{{ toast.title }}</Toast.Title>
            <Toast.Description class="bench-toast-description">
              {{ toast.description }}
            </Toast.Description>
          </div>
          <Toast.ActionTrigger v-if="toast.action" data-bench="toast-action">
            {{ toast.action.label }}
          </Toast.ActionTrigger>
          <Toast.CloseTrigger data-bench="toast-close">Close</Toast.CloseTrigger>
        </div>
      </Toast.Root>
    </Toaster>
  </Teleport>
</template>

<style>
/* The CSS of "Styling" in the docs, which the stack of a toaster needs. */
[data-scope='toast'][data-part='root'] {
  width: 360px;
  height: var(--height);
  opacity: var(--opacity);
  translate: var(--x) var(--y);
  scale: var(--scale);
  z-index: var(--z-index);
  transition:
    translate 400ms,
    scale 400ms,
    opacity 400ms,
    height 400ms,
    box-shadow 200ms;
  transition-timing-function: cubic-bezier(0.21, 1.02, 0.73, 1);
  will-change: translate, opacity, scale;
}

[data-scope='toast'][data-part='root'][data-state='closed'] {
  transition:
    translate 400ms,
    scale 400ms,
    opacity 200ms;
  transition-timing-function: cubic-bezier(0.06, 0.71, 0.55, 1);
}
</style>
