<script setup lang="ts">
import type { PropType } from 'vue';
import { Progress } from '../../src/progress';

defineProps({
  outside: { type: Object as PropType<Element>, required: true },
  scene: { type: Object as PropType<{ label: boolean }>, required: true },
});
</script>

<template>
  <Progress.Root :value="30">
    <Teleport :to="outside">
      <Progress.Label v-if="scene.label">Upload</Progress.Label>
    </Teleport>
  </Progress.Root>
</template>
