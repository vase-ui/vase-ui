<script setup lang="ts">
import { computed, provide } from 'vue';
import { DirectionContext, type TextDirection } from './DirectionContext';

// The modules of this context have no public provider. Their tests give the direction with it.
const props = defineProps<{ direction: TextDirection }>();
defineSlots<{ default?: () => unknown }>();

provide(
  DirectionContext,
  computed(() => props.direction),
);
</script>

<template>
  <slot />
</template>
