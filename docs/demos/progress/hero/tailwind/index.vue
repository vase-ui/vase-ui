<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { Progress } from '@vase-ui/vue/progress';

const value = ref(20);
let interval: ReturnType<typeof setInterval> | undefined;

// Simulate changes
onMounted(() => {
  interval = setInterval(() => {
    value.value = Math.min(100, Math.round(value.value + Math.random() * 25));
  }, 1000);
});

onUnmounted(() => clearInterval(interval));
</script>

<template>
  <Progress.Root class="grid max-w-full w-60 grid-cols-2 gap-y-2" :value="value">
    <Progress.Label class="text-sm font-normal text-neutral-950 dark:text-white"
      >Export data</Progress.Label
    >
    <Progress.Value class="text-right text-sm text-neutral-950 dark:text-white" />
    <Progress.Track class="col-span-2 h-1 overflow-hidden bg-neutral-200 dark:bg-neutral-800">
      <Progress.Indicator class="bg-neutral-950 transition-[width] duration-500 dark:bg-white" />
    </Progress.Track>
  </Progress.Root>
</template>
