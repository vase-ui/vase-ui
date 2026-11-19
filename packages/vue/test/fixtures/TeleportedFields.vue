<script setup lang="ts">
import type { PropType } from 'vue';
import { Field } from '../../src/field';
import { Form } from '../../src/form';
import { Input } from '../../src/input';

defineProps({
  form: Object as PropType<Record<string, unknown>>,
  outside: { type: Object as PropType<Element>, required: true },
  otherForm: { type: Object as PropType<HTMLFormElement>, required: true },
});
</script>

<template>
  <Form id="profile" v-bind="form">
    <Teleport :to="outside">
      <Field.Root>
        <Input id="outside" required />
      </Field.Root>
      <Field.Root>
        <Input id="outside-with-form-attribute" required form="profile" />
      </Field.Root>
    </Teleport>
    <Teleport :to="otherForm">
      <Field.Root>
        <Input id="in-other-form" required />
      </Field.Root>
    </Teleport>
    <Field.Root>
      <Input id="given-to-other-form" required :form="otherForm.id" />
    </Field.Root>
    <button type="submit">Submit</button>
  </Form>
</template>
