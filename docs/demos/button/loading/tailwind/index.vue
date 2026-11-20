<script setup lang="ts">
import { ref, useId } from 'vue';
import { Button } from '@vase-ui/vue/button';

const loading = ref(false);
const labelId = useId();

function submit() {
  loading.value = true;
  setTimeout(() => {
    loading.value = false;
  }, 4000);
}
</script>

<template>
  <Button
    class="flex h-8 items-center justify-center gap-2 rounded-none border border-neutral-950 bg-white px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none hover:not-disabled:not-aria-disabled:bg-neutral-100 active:not-disabled:not-aria-disabled:bg-neutral-200 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white aria-disabled:border-neutral-500 aria-disabled:text-neutral-500 disabled:border-neutral-500 disabled:text-neutral-500 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-disabled:not-aria-disabled:bg-neutral-800 dark:active:not-disabled:not-aria-disabled:bg-neutral-700 dark:aria-disabled:border-neutral-400 dark:disabled:border-neutral-400 dark:aria-disabled:text-neutral-400 dark:disabled:text-neutral-400"
    :disabled="loading"
    focusable-when-disabled
    :aria-labelledby="labelId"
    @click="submit"
  >
    <span :id="labelId">{{ loading ? 'Submitting' : 'Submit' }}</span>
  </Button>
</template>
