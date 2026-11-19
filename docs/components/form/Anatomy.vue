<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';
import { Input } from '@vase-ui/vue/input';
import { Form } from '@vase-ui/vue/form';
</script>

<template>
  <Form>
    <Field.Root>
      <Field.Label />
      <Input />
      <Field.Error />
    </Field.Root>
  </Form>
</template>
