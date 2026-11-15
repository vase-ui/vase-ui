<script setup lang="ts">
import { Toast } from '@vase-ui/vue/toast';

const toastManager = Toast.useToastManager();
let count = 0;

function createToast() {
  count += 1;
  toastManager.add({
    title: `Toast ${count} created`,
    description: 'This is a toast notification.',
  });
}
</script>

<template>
  <button
    type="button"
    class="flex h-8 items-center justify-center gap-2 rounded-none border border-neutral-950 bg-white px-3 py-0 font-[inherit] text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none hover:bg-neutral-100 active:bg-neutral-200 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:bg-neutral-800 dark:active:bg-neutral-700 disabled:border-neutral-500 disabled:text-neutral-500 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
    @click="createToast"
  >
    Create toast
  </button>
</template>
