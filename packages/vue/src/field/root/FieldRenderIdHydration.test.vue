<script setup lang="ts">
import { Field } from '../index';

// The control comes before the label. A label that read the element of the control before the
// mount would then give the hydration another `for` than the server HTML.
</script>

<template>
  <Field.Root>
    <Field.Control data-testid="control">
      <template #render="{ props }">
        <input v-bind="props" id="own" />
      </template>
    </Field.Control>
    <Field.Label data-testid="label">Label</Field.Label>
    <Field.Description>
      <template #render="{ props }">
        <p v-bind="props" id="own-description">Description</p>
      </template>
    </Field.Description>
  </Field.Root>
</template>
