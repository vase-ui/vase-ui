<script setup lang="ts">
import { provide } from 'vue';
import { localeKey } from '../common/locale';
import type { LocaleProviderProps } from './types';

const props = defineProps<LocaleProviderProps>();
defineSlots<{ default?(): unknown }>();

provide(localeKey, () => props.locale);
</script>

<template>
  <slot />
</template>
