<script setup lang="ts">
import { Switch } from '@vase-ui/vue/switch';
</script>

<template>
  <label class="flex items-center gap-2 text-sm font-normal text-neutral-950 dark:text-white">
    <span class="relative flex shrink-0">
      <Switch
        default-checked
        class="peer m-0 h-5 w-9 appearance-none rounded-none border border-neutral-950 bg-white transition-colors duration-150 ease-[ease] checked:bg-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 dark:border-white dark:bg-neutral-950 dark:checked:bg-white dark:focus-visible:outline-white"
      />
      <span
        class="pointer-events-none absolute top-[0.1875rem] left-[0.1875rem] size-3.5 bg-neutral-950 transition-[translate,background-color] duration-150 ease-[ease] peer-checked:translate-x-4 peer-checked:bg-white dark:bg-white dark:peer-checked:bg-neutral-950"
      />
    </span>
    Notifications
  </label>
</template>
