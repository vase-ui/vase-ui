<script setup lang="ts">
import { Combobox } from '@vase-ui/vue/combobox';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
</script>

<template>
  <Form>
    <Field.Root name="country">
      <Field.Label>Country of residence</Field.Label>
      <Combobox.Root>
        <Combobox.Input />
      </Combobox.Root>
    </Field.Root>
  </Form>
</template>
