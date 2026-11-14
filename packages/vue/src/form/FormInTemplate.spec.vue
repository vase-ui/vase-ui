<!-- @strictTemplates true -->
<script setup lang="ts">
import { expectType } from '#test-utils';
import { Form } from '@vase-ui/vue/form';

interface Values {
  name: string;
  age: number;
}

function onTypeLiteral(formValues: { id: string; quantity: number }) {
  return formValues.id + String(formValues.quantity);
}

function onInterface(formValues: Values, eventDetails: Form.SubmitEventDetails) {
  return formValues.name + eventDetails.reason;
}

function onFormValues(formValues: Form.Values) {
  return formValues;
}

function onWrongEventDetails(formValues: Values, eventDetails: string) {
  return formValues.name + eventDetails;
}
</script>

<template>
  <Form @form-submit="onTypeLiteral" />
  <Form @form-submit="onInterface" />
  <Form @form-submit.once="onInterface" />
  <Form @form-submit="(formValues: { id: string }) => formValues.id" />
  <Form @form-submit="onFormValues" />
  <Form
    @form-submit="
      (formValues, eventDetails) => {
        expectType<any, typeof formValues>(formValues);
        expectType<'none', typeof eventDetails.reason>(eventDetails.reason);
      }
    "
  />
  <!-- @vue-expect-error `eventDetails` is an object -->
  <Form @form-submit="onWrongEventDetails" />
</template>
