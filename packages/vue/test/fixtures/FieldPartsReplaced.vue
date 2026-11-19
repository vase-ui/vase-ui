<script setup lang="ts">
import { Field } from '../../src/field';
import { Input } from '../../src/input';

defineProps({ root: Object });
</script>

<template>
  <Field.Root v-bind="root">
    <template #element="{ props, elementRef }">
      <section v-bind="props" :ref="elementRef">
        <Field.Label>
          <template #element="{ props: labelProps, elementRef: labelRef }">
            <span v-bind="labelProps" :ref="labelRef">Name</span>
          </template>
        </Field.Label>
        <Input aria-label="Name" />
        <Field.Description>
          <template #element="{ props: descriptionProps, elementRef: descriptionRef }">
            <small v-bind="descriptionProps" :ref="descriptionRef">Your full name.</small>
          </template>
        </Field.Description>
        <Field.Error>
          <template #element="{ props: errorProps, elementRef: errorRef, messages }">
            <strong v-bind="errorProps" :ref="errorRef">{{ messages.join(' / ') }}</strong>
          </template>
        </Field.Error>
      </section>
    </template>
  </Field.Root>
</template>
