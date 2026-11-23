<script setup lang="ts">
import { defineAsyncComponent, hydrateOnInteraction } from 'vue';
import ButtonAsComponent from './ButtonAsComponent.vue';

// The loader gives the component at once, so the hydration waits only for the focus.
const LazyButton = defineAsyncComponent({
  loader: () => Promise.resolve(ButtonAsComponent),
  hydrate: hydrateOnInteraction('focusin'),
});
</script>

<template>
  <input aria-label="Before" class="Before" />
  <LazyButton component="div" />
  <input aria-label="After" class="After" />
</template>
