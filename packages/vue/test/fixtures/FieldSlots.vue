<script setup lang="ts">
import { Field } from '../../src/field';
import { Input } from '../../src/input';

defineProps({ root: Object });
</script>

<template>
  <Field.Root v-slot="{ state, validity, errors }" v-bind="root">
    <output class="root">{{ JSON.stringify({ state, validity, errors }) }}</output>
    <Field.Label v-slot="{ state: labelState }">{{ JSON.stringify(labelState) }}</Field.Label>
    <Input required />
    <Field.Description v-slot="{ state: descriptionState }">
      {{ JSON.stringify(descriptionState) }}
    </Field.Description>
    <Field.Error v-slot="{ state: errorState }">{{ JSON.stringify(errorState) }}</Field.Error>
  </Field.Root>
</template>
