<script setup lang="ts">
import { shallowRef } from 'vue';
import { Autocomplete } from '@vase-ui/vue/autocomplete';
import { Combobox } from '@vase-ui/vue/combobox';
import { Field } from '@vase-ui/vue/field';
import { OTPField } from '@vase-ui/vue/otp-field';
import { Toolbar } from '@vase-ui/vue/toolbar';

const fruits = ['Apple', 'Banana', 'Cherry'];

const code = shallowRef('');
const fruitText = shallowRef('');
const search = shallowRef('');
const toolbarText = shallowRef('');

function handleToolbarInput(event: Event) {
  toolbarText.value = (event.currentTarget as HTMLInputElement).value;
}
</script>

<template>
  <main>
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

    <Toolbar.Root>
      <Toolbar.Input
        :value="toolbarText"
        aria-label="Filter"
        data-testid="toolbar-input"
        @input="handleToolbarInput"
      />
    </Toolbar.Root>
    <output data-testid="toolbar-value">{{ toolbarText }}</output>
  </main>
</template>
