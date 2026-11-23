<script setup lang="ts">
import {
  Listbox,
  ListboxButton,
  ListboxLabel,
  ListboxOption,
  ListboxOptions,
} from '@headlessui/vue';
import { ref } from 'vue';
import { options } from '../../../harness/options.ts';
import '../../../behavior/style.css';

const selectedOption = ref('Option 1');
</script>

<template>
  <div class="bench-page">
    <Listbox v-model="selectedOption">
      <ListboxLabel>Label</ListboxLabel>
      <ListboxButton data-bench="trigger">{{ selectedOption }}</ListboxButton>
      <Transition
        enter-active-class="bench-motion"
        leave-active-class="bench-motion"
        enter-from-class="bench-hidden"
        leave-to-class="bench-hidden"
      >
        <ListboxOptions data-bench="popup">
          <ListboxOption v-for="option in options" :key="option" :value="option">
            {{ option }}
          </ListboxOption>
        </ListboxOptions>
      </Transition>
    </Listbox>
  </div>
</template>
