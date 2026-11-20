<script setup lang="ts">
import { shallowRef } from 'vue';
import { Autocomplete } from '@vase-ui/vue/autocomplete';
import { Combobox } from '@vase-ui/vue/combobox';

const fruits = ['Apple', 'Banana', 'Cherry'];

const fruitText = shallowRef('');
const search = shallowRef('');
</script>

<template>
  <main>
    <Combobox.Root v-model:input-value="fruitText" :items="fruits">
      <Combobox.Input aria-label="Fruit" data-testid="combobox-input" />
    </Combobox.Root>
    <output data-testid="combobox-value">{{ fruitText }}</output>

    <Autocomplete.Root v-model="search" :items="fruits">
      <Autocomplete.Input aria-label="Search" data-testid="autocomplete-input" />
    </Autocomplete.Root>
    <output data-testid="autocomplete-value">{{ search }}</output>
  </main>
</template>
