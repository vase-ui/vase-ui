<script setup lang="ts">
import type { PropType } from 'vue';
import { LocaleProvider } from '../../src/locale-provider';
import { NumberField } from '../../src/number-field';

// A number field in a `LocaleProvider`, and one with a `locale` prop of its own.
defineProps({ provider: { type: Object as PropType<{ locale: string }>, required: true } });
</script>

<template>
  <LocaleProvider :locale="provider.locale">
    <NumberField.Root :default-value="1234.5">
      <NumberField.Input aria-label="Provider" />
    </NumberField.Root>
    <NumberField.Root :default-value="1234.5" locale="fr-FR">
      <NumberField.Input aria-label="Own" />
    </NumberField.Root>
  </LocaleProvider>
</template>
