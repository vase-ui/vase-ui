<script setup lang="ts">
import { useIsHydrating } from './useIsHydrating';

const isHydrating = useIsHydrating();
</script>

<template>
  <span data-testid="value">{{ isHydrating }}</span>
</template>
