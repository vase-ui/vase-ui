<script setup lang="ts">
import type { PropType } from 'vue';
import { Field } from '../../src/field';
import { Fieldset } from '../../src/fieldset';
import { Input } from '../../src/input';

defineProps({
  field: Object as PropType<Record<string, unknown>>,
  input: Object as PropType<Record<string, unknown>>,
});
</script>

<template>
  <Fieldset.Legend>
    <Field.Root>
      <Field.Label>Billing</Field.Label>
      <Input id="in-legend" name="in-legend" />
    </Field.Root>
  </Fieldset.Legend>
  <Field.Root name="company" v-bind="field">
    <Field.Label>Company</Field.Label>
    <Input id="company" v-bind="input" />
    <Field.Description>On each invoice.</Field.Description>
    <Field.Error />
  </Field.Root>
  <Input id="alone" name="alone">
    <template #element="{ props, elementRef, state }">
      <input
        v-bind="props"
        :ref="elementRef"
        aria-label="Alone"
        :data-state-disabled="state.disabled || undefined"
      />
    </template>
  </Input>
</template>
