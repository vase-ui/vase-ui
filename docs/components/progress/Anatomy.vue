<script setup lang="ts">
import { Progress } from '@vase-ui/vue/progress';
</script>

<template>
  <Progress.Root :value="null">
    <Progress.Label />
    <Progress.Track>
      <Progress.Indicator />
    </Progress.Track>
    <Progress.Value />
  </Progress.Root>
</template>
