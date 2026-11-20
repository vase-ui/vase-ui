<script setup lang="ts">
import type { PropType } from 'vue';
import { Button } from '../../src/button';

defineProps({ scene: { type: Object as PropType<{ shown: boolean }>, required: true } });
</script>

<template>
  <Transition>
    <Button v-if="scene.shown">Shown</Button>
  </Transition>
</template>
