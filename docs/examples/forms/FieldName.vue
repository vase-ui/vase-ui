<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import { NumberField } from '@vase-ui/vue/number-field';
</script>

<template>
  <Form>
    <Field.Root name="quantity">
      <Field.Label>Quantity</Field.Label>
      <NumberField.Root>
        <NumberField.Input />
      </NumberField.Root>
    </Field.Root>
  </Form>
</template>
