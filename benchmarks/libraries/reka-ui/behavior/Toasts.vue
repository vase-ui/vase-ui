<script setup lang="ts">
import { createToastManager, ToastProvider } from 'reka-ui';
import { toastTimeout } from '../../../harness/toastTimeout.ts';
import '../../../behavior/style.css';
import '../../../behavior/toasts.css';
import ToastList from './ToastList.vue';

const toastManager = createToastManager();

// The docs give the type `foreground` to a toast that a screen reader announces at once.
function addToast(important = false) {
  toastManager.add({
    title: 'Saved',
    description: 'The file is saved.',
    duration: toastTimeout,
    ...(important ? { type: 'foreground' } : {}),
    actionProps: { label: 'Undo', altText: 'Undo the save' },
  });
}
</script>

<template>
  <ToastProvider :toast-manager="toastManager">
    <div class="bench-page">
      <button type="button" data-bench="add-toast" @click="addToast()">Add toast</button>
      <button type="button" data-bench="add-important-toast" @click="addToast(true)">
        Add important toast
      </button>
    </div>
    <ToastList />
  </ToastProvider>
</template>

<style>
/* The stack of the example "Stacking toasts" and the swipe of "Animating swipe gesture" of the docs. */
.bench-toast {
  position: absolute;
  right: 0;
  bottom: 0;
  z-index: calc(1000 - var(--reka-toast-index));
  width: 100%;
  height: var(--reka-toast-frontmost-height);
  transform: translateY(calc(var(--reka-toast-index) * -12px))
    scale(calc(1 - var(--reka-toast-index) * 0.05));
  transition:
    transform 300ms,
    opacity 300ms,
    height 300ms;
}

.bench-toast-viewport[data-expanded] .bench-toast {
  height: var(--reka-toast-height);
  transform: translateY(calc(var(--reka-toast-offset-y) * -1 - var(--reka-toast-index) * 12px));
}

.bench-toast[data-limited] {
  opacity: 0;
}

.bench-toast[data-swipe='move'] {
  transform: translateX(var(--reka-toast-swipe-move-x));
}

.bench-toast[data-swipe='cancel'] {
  transform: translateX(0);
  transition: transform 200ms ease-out;
}

.bench-toast[data-swipe='end'] {
  animation: bench-toast-slide-right 100ms ease-out;
}

@keyframes bench-toast-slide-right {
  from {
    transform: translateX(var(--reka-toast-swipe-end-x));
  }

  to {
    transform: translateX(100%);
  }
}
</style>
