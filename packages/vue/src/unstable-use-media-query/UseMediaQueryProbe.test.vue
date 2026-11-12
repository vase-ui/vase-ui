<script setup lang="ts">
import { useMediaQuery } from './index';

const props = defineProps<{ query: string; defaultMatches?: boolean | undefined }>();

const matches = useMediaQuery(
  () => props.query,
  () => ({ defaultMatches: props.defaultMatches }),
);
</script>

<template>
  <span data-testid="result">{{ matches }}</span>
</template>
