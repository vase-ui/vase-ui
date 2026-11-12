<script setup lang="ts">
import { useFormatLocale } from './useFormatLocale';

const props = defineProps<{ locale?: string | undefined }>();

const formatLocale = useFormatLocale(() => props.locale);
</script>

<template>
  <span data-testid="locale">{{ String(formatLocale) }}</span>
</template>
