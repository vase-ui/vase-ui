<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { Progress } from '@vase-ui/vue/progress';
import styles from './index.module.css';

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
  <Progress.Root :class="styles.Progress" :value="value">
    <Progress.Label :class="styles.Label">Export data</Progress.Label>
    <Progress.Value :class="styles.Value" />
    <Progress.Track :class="styles.Track">
      <Progress.Indicator :class="styles.Indicator" />
    </Progress.Track>
  </Progress.Root>
</template>
