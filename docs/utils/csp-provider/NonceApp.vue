<script setup lang="ts">
import { CSPProvider } from '@vase-ui/vue/csp-provider';

defineProps<{ nonce: string }>();
</script>

<template>
  <CSPProvider :nonce="nonce">
    <!-- ... -->
  </CSPProvider>
</template>
