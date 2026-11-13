<script setup lang="ts">
import { ref } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';

const submitted = ref('');

function readEmail(event: SubmitEvent) {
  submitted.value = String(new FormData(event.currentTarget as HTMLFormElement).get('email'));
}
</script>

<template>
  <main>
    <Field.Root name="name" data-testid="root">
      <Field.Control default-value="foo" data-testid="control" />
    </Field.Root>
    <Field.Root invalid data-testid="invalid-root">
      <Field.Control data-testid="invalid-control" />
    </Field.Root>
    <Field.Root data-testid="label-first">
      <Field.Label data-testid="label-first-label">Name</Field.Label>
      <Field.Control data-testid="label-first-control" />
      <Field.Description data-testid="label-first-description">Description</Field.Description>
      <Field.Error match data-testid="label-first-error">Error</Field.Error>
    </Field.Root>
    <Field.Root data-testid="label-last">
      <Field.Description data-testid="label-last-description">Description</Field.Description>
      <Field.Error match data-testid="label-last-error">Error</Field.Error>
      <Field.Control data-testid="label-last-control" />
      <Field.Label data-testid="label-last-label">Name</Field.Label>
    </Field.Root>
    <Form data-testid="form" @submit.prevent="readEmail">
      <Field.Root name="email">
        <Field.Label>Email</Field.Label>
        <Field.Control required data-testid="required-control" />
        <Field.Error match="valueMissing" data-testid="required-error">Required</Field.Error>
      </Field.Root>
      <button type="submit" data-testid="submit">Send</button>
    </Form>
    <output data-testid="output">{{ submitted }}</output>
  </main>
</template>
