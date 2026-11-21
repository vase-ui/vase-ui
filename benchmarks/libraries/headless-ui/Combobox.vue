<script setup lang="ts">
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxLabel,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/vue';
import { computed, ref } from 'vue';
import { options } from '../../harness/options.ts';

// Headless UI has no built-in filter. Its documentation filters the options in a computed property.
const selectedOption = ref<string | null>(null);
const query = ref('');
const filteredOptions = computed(() =>
  query.value === ''
    ? options
    : options.filter((option) => option.toLowerCase().includes(query.value.toLowerCase())),
);
</script>

<template>
  <Combobox v-model="selectedOption">
    <ComboboxLabel>Label</ComboboxLabel>
    <ComboboxInput data-bench="input" @change="query = $event.target.value" />
    <ComboboxButton data-bench="trigger">Open</ComboboxButton>
    <ComboboxOptions data-bench="popup">
      <ComboboxOption v-for="option in filteredOptions" :key="option" :value="option">
        {{ option }}
      </ComboboxOption>
    </ComboboxOptions>
  </Combobox>
</template>
