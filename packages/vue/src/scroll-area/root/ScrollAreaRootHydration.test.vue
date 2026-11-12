<script setup lang="ts">
import { CSPProvider } from '../../csp-provider';
import { ScrollArea } from '../index';

defineProps<{
  nonce?: string | undefined;
  disableStyleElements?: boolean | undefined;
}>();
</script>

<template>
  <CSPProvider :nonce="nonce" :disable-style-elements="disableStyleElements">
    <ScrollArea.Root data-testid="root">Content</ScrollArea.Root>
  </CSPProvider>
</template>
