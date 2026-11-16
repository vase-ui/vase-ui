<script setup lang="ts">
import { getServerElement } from './hydration';

const props = defineProps<{
  /** What the part renders: an element, a fragment that has one, an empty fragment or nothing. */
  form: 'element' | 'fragment' | 'empty fragment' | 'no element';
  /** Gets the `data-testid` of the server element, or `null` for no element. */
  onRead?: ((testId: string | null) => void) | undefined;
}>();

props.onRead?.(getServerElement()?.getAttribute('data-testid') ?? null);
</script>

<template>
  <span v-if="form === 'element'" data-testid="own" />
  <slot v-else-if="form === 'fragment'"><span data-testid="own" /></slot>
  <slot v-else-if="form === 'empty fragment'" />
</template>
