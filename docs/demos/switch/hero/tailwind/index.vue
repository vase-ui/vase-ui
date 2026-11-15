<script setup lang="ts">
import { Switch } from '@vase-ui/vue/switch';
</script>

<template>
  <label class="flex items-center gap-2 text-sm font-normal text-neutral-950 dark:text-white">
    <Switch.Root
      default-checked
      class="flex h-5 w-9 shrink-0 border border-neutral-950 bg-white p-0.5 transition-colors duration-150 ease-[ease] dark:border-white dark:bg-neutral-950 data-checked:bg-neutral-950 dark:data-checked:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
    >
      <Switch.Thumb
        class="size-3.5 bg-neutral-950 transition-[translate,background-color] duration-150 ease-[ease] data-checked:translate-x-4 data-checked:bg-white dark:bg-white dark:data-checked:bg-neutral-950"
      />
    </Switch.Root>
    Notifications
  </label>
</template>
