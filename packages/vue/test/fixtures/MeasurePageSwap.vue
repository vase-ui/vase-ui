<script setup lang="ts">
import type { PropType } from 'vue';
import MeasureHookPage from './MeasureHookPage.vue';

// One page at a time, by `scene.page`, with no wrapper, in a `<Transition>`, in a
// `<TransitionGroup>` or in a `<Suspense>` (the form of a page of Nuxt).
defineProps({
  wrapper: {
    type: String as PropType<'none' | 'Transition' | 'TransitionGroup' | 'Suspense'>,
    required: true,
  },
  scene: { type: Object as PropType<{ page: string }>, required: true },
  gates: { type: Object as PropType<Record<string, Promise<void>>>, default: () => ({}) },
  log: { type: Array as PropType<string[]>, required: true },
});
</script>

<template>
  <Transition v-if="wrapper === 'Transition'" name="t">
    <MeasureHookPage :key="scene.page" :name="scene.page" :log :gate="gates[scene.page]" />
  </Transition>
  <TransitionGroup v-else-if="wrapper === 'TransitionGroup'" name="t">
    <MeasureHookPage :key="scene.page" :name="scene.page" :log :gate="gates[scene.page]" />
  </TransitionGroup>
  <Suspense v-else-if="wrapper === 'Suspense'">
    <MeasureHookPage :key="scene.page" :name="scene.page" :log :gate="gates[scene.page]" />
  </Suspense>
  <MeasureHookPage v-else :key="scene.page" :name="scene.page" :log :gate="gates[scene.page]" />
</template>
