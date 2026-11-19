<script setup lang="ts">
import type { PropType } from 'vue';
import { Form } from '../../src/form';

defineProps({ scene: { type: Object as PropType<{ shown: boolean }>, required: true } });
</script>

<template>
  <Transition>
    <Form v-if="scene.shown" />
  </Transition>
</template>
