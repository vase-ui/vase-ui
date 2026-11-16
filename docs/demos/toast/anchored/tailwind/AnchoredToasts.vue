<script setup lang="ts">
import { Toast } from '@vase-ui/vue/toast';

const { toasts } = Toast.useToastManager();
</script>

<template>
  <Toast.Portal>
    <Toast.Viewport class="outline-0" aria-label="Anchored notifications">
      <Toast.Positioner
        v-for="toast in toasts"
        :key="toast.id"
        :toast="toast"
        class="z-[calc(1000-var(--toast-index))]"
      >
        <Toast.Root
          :toast="toast"
          class="w-max border border-neutral-950 bg-white px-2 py-1 text-sm text-neutral-950 origin-[var(--transform-origin)] shadow-[0.25rem_0.25rem_0] shadow-black/12 transition-[scale,opacity] duration-100 ease-out data-ending-style:opacity-0 data-ending-style:scale-[0.98] data-starting-style:opacity-0 data-starting-style:scale-[0.98] dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
        >
          <Toast.Content>
            <Toast.Description />
          </Toast.Content>
        </Toast.Root>
      </Toast.Positioner>
    </Toast.Viewport>
  </Toast.Portal>
</template>
