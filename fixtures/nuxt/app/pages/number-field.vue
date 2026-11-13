<script setup lang="ts">
import { ref } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { NumberField } from '@vase-ui/vue/number-field';

const quantity = ref<number | null>(1234.5);
</script>

<template>
  <main>
    <form data-testid="form">
      <NumberField.Root
        v-model:value="quantity"
        name="quantity"
        :format="{ minimumFractionDigits: 2 }"
      >
        <NumberField.Group>
          <NumberField.Input data-testid="quantity" aria-label="Quantity" />
        </NumberField.Group>
      </NumberField.Root>
      <NumberField.Root
        name="price"
        :default-value="54.5"
        locale="de-DE"
        :format="{ style: 'currency', currency: 'EUR' }"
      >
        <NumberField.Input data-testid="price" aria-label="Price" />
      </NumberField.Root>
    </form>
    <output data-testid="quantity-value">{{ quantity }}</output>
    <Field.Root data-testid="label-first">
      <Field.Label data-testid="label-first-label">Amount</Field.Label>
      <NumberField.Root>
        <NumberField.Input data-testid="label-first-control" />
      </NumberField.Root>
      <Field.Description data-testid="label-first-description">Description</Field.Description>
      <Field.Error match data-testid="label-first-error">Error</Field.Error>
    </Field.Root>
    <Field.Root data-testid="label-last">
      <Field.Description data-testid="label-last-description">Description</Field.Description>
      <Field.Error match data-testid="label-last-error">Error</Field.Error>
      <NumberField.Root>
        <NumberField.Input data-testid="label-last-control" />
      </NumberField.Root>
      <Field.Label data-testid="label-last-label">Amount</Field.Label>
    </Field.Root>
  </main>
</template>
