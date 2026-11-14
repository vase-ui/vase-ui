<script setup lang="ts">
import { ref } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { NumberField } from '@vase-ui/vue/number-field';

const amount = ref<number | null>(1234.5);
</script>

<template>
  <main>
    <form data-testid="form">
      <Field.Root name="amount" data-testid="label-first">
        <Field.Label data-testid="label-first-label">Amount</Field.Label>
        <NumberField.Root v-model:value="amount" :format="{ style: 'currency', currency: 'EUR' }">
          <NumberField.Group>
            <NumberField.Input data-testid="label-first-control" />
          </NumberField.Group>
        </NumberField.Root>
        <Field.Description data-testid="label-first-description">Description</Field.Description>
        <Field.Error match data-testid="label-first-error">Error</Field.Error>
      </Field.Root>
      <Field.Root name="quantity" data-testid="label-last">
        <Field.Description data-testid="label-last-description">Description</Field.Description>
        <Field.Error match data-testid="label-last-error">Error</Field.Error>
        <NumberField.Root :default-value="7">
          <NumberField.Group>
            <NumberField.Input data-testid="label-last-control" />
          </NumberField.Group>
        </NumberField.Root>
        <Field.Label data-testid="label-last-label">Quantity</Field.Label>
      </Field.Root>
      <output data-testid="amount-value">{{ amount }}</output>
    </form>
  </main>
</template>
