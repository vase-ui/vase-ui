<script setup lang="ts">
import type { PropType } from 'vue';
import MeasureRegister from './MeasureRegister.vue';

defineProps({
  scene: { type: Object as PropType<{ first: boolean }>, required: true },
  transition: Boolean,
});
const emit = defineEmits<{ log: [entry: string] }>();
</script>

<template>
  <Transition v-if="transition">
    <MeasureRegister v-if="scene.first" key="first" name="first" @log="emit('log', $event)" />
    <MeasureRegister v-else key="second" name="second" @log="emit('log', $event)" />
  </Transition>
  <div v-else>
    <MeasureRegister v-if="scene.first" name="first" @log="emit('log', $event)" />
    <MeasureRegister v-else name="second" @log="emit('log', $event)" />
  </div>
</template>
