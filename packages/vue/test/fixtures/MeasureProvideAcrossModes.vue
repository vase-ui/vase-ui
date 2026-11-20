<script setup lang="ts">
import { VdomInjector, VdomProvider } from './measureProvide';
import MeasureVaporInjector from './MeasureVaporInjector.vue';
import MeasureVaporProvider from './MeasureVaporProvider.vue';

// A provider of each mode, with an injector of the other mode in its slot.
defineProps<{ scene: { text: string } }>();
</script>

<template>
  <div>
    <VdomProvider :text="scene.text"><MeasureVaporInjector /></VdomProvider>
    <MeasureVaporProvider :text="scene.text"><VdomInjector /></MeasureVaporProvider>
  </div>
</template>
