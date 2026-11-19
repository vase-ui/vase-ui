<script setup lang="ts">
import type { PropType } from 'vue';
import { Input } from '../../src/input';

defineProps({ scene: { type: Object as PropType<{ shown: boolean }>, required: true } });
</script>

<template>
  <Transition>
    <Input v-if="scene.shown" />
  </Transition>
</template>
