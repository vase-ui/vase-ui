<script lang="ts">
export interface CSPProviderState {}

export interface CSPProviderProps {
  /**
   * The nonce value to apply to inline `<style>` and `<script>` tags.
   */
  nonce?: string | undefined;
  /**
   * Whether inline `<style>` elements created by Vase UI components should not be rendered. Instead, components must specify the CSS styles via custom class names or other methods.
   * @default false
   */
  disableStyleElements?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed, provide } from 'vue';
import { CSPContext } from '../internals/csp-context/CSPContext';

const props = withDefaults(defineProps<CSPProviderProps>(), {
  disableStyleElements: false,
});

defineSlots<{
  default?: () => unknown;
}>();

provide(
  CSPContext,
  computed(() => ({ nonce: props.nonce, disableStyleElements: props.disableStyleElements })),
);
</script>

<template>
  <slot />
</template>
