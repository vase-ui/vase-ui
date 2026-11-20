<script setup lang="ts">
import type { PropType } from 'vue';
import { Field } from '../../src/field';
import { Form } from '../../src/form';
import { NumberField } from '../../src/number-field';

type Attrs = Record<string, unknown>;

// A number field in a `Field` in a `Form`. With `partsAfter`, the label and the description come
// after the number field.
defineProps({
  form: Object as PropType<Attrs>,
  field: Object as PropType<Attrs>,
  root: Object as PropType<Attrs>,
  input: Object as PropType<Attrs>,
  partsAfter: Boolean,
});
</script>

<template>
  <Form v-bind="form">
    <Field.Root v-bind="field">
      <template v-if="!partsAfter">
        <Field.Label>Amount</Field.Label>
        <Field.Description id="description">In euros.</Field.Description>
      </template>
      <NumberField.Root v-bind="root">
        <NumberField.Group>
          <NumberField.Decrement aria-label="Decrease">−</NumberField.Decrement>
          <NumberField.Input v-bind="input" />
          <NumberField.Increment aria-label="Increase">+</NumberField.Increment>
        </NumberField.Group>
      </NumberField.Root>
      <template v-if="partsAfter">
        <Field.Label>Amount</Field.Label>
        <Field.Description id="description">In euros.</Field.Description>
      </template>
      <Field.Error id="error" />
    </Field.Root>
    <button>Submit</button>
    <button type="reset">Reset</button>
  </Form>
</template>
