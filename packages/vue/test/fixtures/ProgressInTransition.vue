<script setup lang="ts">
import type { PropType } from 'vue';
import { Progress } from '../../src/progress';

defineProps({ scene: { type: Object as PropType<{ shown: boolean }>, required: true } });
</script>

<template>
  <Transition>
    <Progress.Root v-if="scene.shown" :value="30">
      <Progress.Label>Upload</Progress.Label>
    </Progress.Root>
  </Transition>
</template>
