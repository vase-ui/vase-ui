<script setup lang="ts">
import { shallowRef } from 'vue';
import { Autocomplete } from '@vase-ui/vue/autocomplete';
import { Combobox } from '@vase-ui/vue/combobox';
import { Field } from '@vase-ui/vue/field';
import { NumberField } from '@vase-ui/vue/number-field';
import { OTPField } from '@vase-ui/vue/otp-field';

const fruits = ['Apple', 'Banana', 'Cherry'];

const amount = shallowRef<number | null>(null);
const code = shallowRef('');
const fruitText = shallowRef('');
const search = shallowRef('');
</script>

<template>
  <main>
    <NumberField.Root v-model="amount" locale="en-US">
      <NumberField.Input aria-label="Amount" data-testid="number-input" />
    </NumberField.Root>
    <output data-testid="number-value">{{ amount }}</output>

    <Field.Root>
      <Field.Label>Code</Field.Label>
      <OTPField.Root v-model="code" :length="4">
        <OTPField.Input v-for="index in 4" :key="index" :data-testid="`otp-input-${index}`" />
      </OTPField.Root>
    </Field.Root>
    <output data-testid="otp-value">{{ code }}</output>

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
