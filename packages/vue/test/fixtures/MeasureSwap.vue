<script setup lang="ts">
import type { PropType } from 'vue';
import MeasureRegister from './MeasureRegister.vue';

defineProps({
  scene: { type: Object as PropType<{ first: boolean }>, required: true },
  log: { type: Array as PropType<string[]>, required: true },
  transition: Boolean,
});
</script>

<template>
  <Transition v-if="transition">
    <MeasureRegister v-if="scene.first" key="first" name="first" :log="log" />
    <MeasureRegister v-else key="second" name="second" :log="log" />
  </Transition>
  <div v-else>
    <MeasureRegister v-if="scene.first" name="first" :log="log" />
    <MeasureRegister v-else name="second" :log="log" />
  </div>
</template>
