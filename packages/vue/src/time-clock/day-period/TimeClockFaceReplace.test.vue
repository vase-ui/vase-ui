<script setup lang="ts">
import { TimeClock } from '@vase-ui/vue/time-clock';

// The first face in the block mounts before the second face unmounts.
defineProps<{ swapped: boolean }>();
</script>

<template>
  <div>
    <TimeClock.Face v-if="swapped" />
    <TimeClock.Face v-if="!swapped" />
  </div>
</template>
