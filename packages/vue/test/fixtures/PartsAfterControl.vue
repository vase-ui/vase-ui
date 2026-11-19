<script setup lang="ts">
import { Field } from '../../src/field';
import { Input } from '../../src/input';
import { Radio } from '../../src/radio';
import { RadioGroup } from '../../src/radio-group';

// A control, or a group with its radios, before the label, the description and the error.
defineProps({ root: Object, group: Boolean });
</script>

<template>
  <Field.Root v-bind="root">
    <RadioGroup v-if="group" default-value="a">
      <Radio value="a" aria-label="A" />
      <Radio value="b" aria-label="B" />
    </RadioGroup>
    <Input v-else />
    <Field.Label>Name</Field.Label>
    <Field.Description id="description">About.</Field.Description>
    <Field.Error id="error" />
  </Field.Root>
</template>
