<!-- @strictTemplates true -->
<script setup lang="ts">
import { expectType } from '#test-utils';
import { Form, type FormValues } from '@vase-ui/vue/form';

interface Values {
  name: string;
  age: number;
}

function save(event: SubmitEvent, values: Values) {
  return event.type + values.name + String(values.age);
}

function saveLiteral(_event: SubmitEvent, values: { id: string; quantity: number }) {
  return values.id + String(values.quantity);
}

function saveValues(_event: SubmitEvent, values: FormValues) {
  return values;
}

function saveWrongEvent(event: string, values: Values) {
  return event + values.name;
}
</script>

<template>
  <Form @submit="save" />
  <Form @submit.prevent="save" />
  <Form @submit.once="saveLiteral" />
  <Form @submit="saveValues" />
  <Form @submit="(_event: SubmitEvent, values: { id: string }) => values.id" />
  <Form
    @submit="
      (event, values) => {
        expectType<SubmitEvent, typeof event>(event);
        expectType<any, typeof values>(values);
      }
    "
  />
  <!-- @vue-expect-error The first argument is the native `SubmitEvent`. -->
  <Form @submit="saveWrongEvent" />
</template>
