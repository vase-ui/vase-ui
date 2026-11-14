<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
</script>

<template>
  <Form>
    <Field.Root>
      <Field.Label />
      <Field.Control />
      <Field.Error />
    </Field.Root>
  </Form>
</template>
