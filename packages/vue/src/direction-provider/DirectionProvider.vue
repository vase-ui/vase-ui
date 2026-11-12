<script lang="ts">
import type { TextDirection } from '../internals/direction-context/DirectionContext';

export interface DirectionProviderState {}

export interface DirectionProviderProps {
  /**
   * The reading direction of the text
   * @default 'ltr'
   */
  direction?: TextDirection | undefined;
}
</script>

<script setup lang="ts">
import { computed, provide } from 'vue';
import { DirectionContext } from '../internals/direction-context/DirectionContext';

const props = withDefaults(defineProps<DirectionProviderProps>(), { direction: 'ltr' });

defineSlots<{ default?: () => unknown }>();

provide(
  DirectionContext,
  computed(() => ({ direction: props.direction })),
);
</script>

<template>
  <slot />
</template>
