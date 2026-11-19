<script setup lang="ts">
import { Field } from '../../src/field';
import { Input } from '../../src/input';
</script>

<template>
  <Field.Root>
    <Field.Label>
      <template #element="{ props, elementRef }">
        <label v-bind="props" id="own-label" :ref="elementRef">Name</label>
      </template>
    </Field.Label>
    <Field.Label>
      <template #element="{ props, elementRef }">
        <span v-bind="props" id="own-span" :ref="elementRef">Full name</span>
      </template>
    </Field.Label>
    <Input>
      <template #element="{ props, elementRef }">
        <input v-bind="props" id="own-input" :ref="elementRef" />
      </template>
    </Input>
    <Field.Description>
      <template #element="{ props, elementRef }">
        <p v-bind="props" id="own-description" :ref="elementRef">Your full name.</p>
      </template>
    </Field.Description>
  </Field.Root>
</template>
