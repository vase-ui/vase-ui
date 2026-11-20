<script setup lang="ts">
import { shallowRef, useTemplateRef } from 'vue';
import { Button } from '@vase-ui/vue/button';
import { anchoredToastManager } from './anchoredToastManager';

const copied = shallowRef(false);
const button = useTemplateRef('button');

function handleCopy() {
  copied.value = true;

  anchoredToastManager.add({
    description: 'Copied',
    positionerProps: {
      anchor: button.value?.element ?? null,
      sideOffset: 10,
    },
    timeout: 1500,
    onClose() {
      copied.value = false;
    },
  });
}
</script>

<template>
  <Button
    ref="button"
    class="flex h-8 w-8 items-center justify-center rounded-none border border-neutral-950 bg-white text-neutral-950 select-none hover:not-disabled:not-aria-disabled:bg-neutral-100 active:not-disabled:not-aria-disabled:bg-neutral-200 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-disabled:not-aria-disabled:bg-neutral-800 dark:active:not-disabled:not-aria-disabled:bg-neutral-700 aria-disabled:border-neutral-500 aria-disabled:text-neutral-500 disabled:border-neutral-500 disabled:text-neutral-500 dark:aria-disabled:border-neutral-400 dark:disabled:border-neutral-400 dark:aria-disabled:text-neutral-400 dark:disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
    aria-label="Copy to clipboard"
    :disabled="copied"
    focusable-when-disabled
    @click="handleCopy"
  >
    <svg
      v-if="copied"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      style="display: block"
    >
      <path d="m2.5 8.5 4 4 7-9" />
    </svg>
    <svg
      v-else
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      style="display: block"
    >
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  </Button>
</template>
