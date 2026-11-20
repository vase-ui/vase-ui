<script setup lang="ts">
import { provide } from 'vue';
import { cspKey } from './part';
import type { CSPProviderProps } from './types';

const { nonce, disableStyleElements = false } = defineProps<CSPProviderProps>();
defineSlots<{ default?(): unknown }>();

provide(cspKey, {
  get nonce() {
    return nonce;
  },
  get disableStyleElements() {
    return disableStyleElements;
  },
});
</script>

<template>
  <slot />
</template>
