<script setup lang="ts">
import {
  Listbox,
  ListboxButton,
  ListboxLabel,
  ListboxOption,
  ListboxOptions,
} from '@headlessui/vue';
import { ref } from 'vue';
import { options } from '../../harness/options.ts';

const selectedOption = ref<string | null>(null);
</script>

<template>
  <Listbox v-model="selectedOption">
    <ListboxLabel>Label</ListboxLabel>
    <ListboxButton data-bench="trigger">{{ selectedOption }}</ListboxButton>
    <ListboxOptions data-bench="popup">
      <ListboxOption v-for="option in options" :key="option" :value="option">
        {{ option }}
      </ListboxOption>
    </ListboxOptions>
  </Listbox>
</template>
