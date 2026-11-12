<script setup lang="ts">
import { useMediaQuery } from '@vase-ui/vue/unstable-use-media-query';

const isWide = useMediaQuery('(min-width: 600px)', { defaultMatches: true });
</script>

<template>
  <main>
    <p data-testid="wide">{{ isWide }}</p>
  </main>
</template>
