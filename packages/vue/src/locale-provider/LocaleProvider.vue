<script setup lang="ts">
import { provide } from 'vue';
import { localeKey } from './part';
import type { LocaleProviderProps } from './types';

const props = defineProps<LocaleProviderProps>();
defineSlots<{ default?(): unknown }>();

provide(localeKey, {
  get locale() {
    return props.locale;
  },
});
</script>

<template>
  <slot />
</template>
