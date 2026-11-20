<script setup lang="ts">
import type { PropType } from 'vue';
import { Field } from '../../src/field';
import { Fieldset } from '../../src/fieldset';
import { NumberField } from '../../src/number-field';

// A number field in a native `<fieldset>` in an invalid `Field`, or in a `Fieldset.Root` with
// another element.
defineProps({
  scene: {
    type: Object as PropType<{ native: boolean; disabled: boolean }>,
    required: true,
  },
});
</script>

<template>
  <form>
    <Field.Root v-if="scene.native" invalid>
      <fieldset :disabled="scene.disabled">
        <NumberField.Root name="amount" :default-value="5">
          <NumberField.Decrement aria-label="Decrease">−</NumberField.Decrement>
          <NumberField.Input aria-label="Amount" />
          <NumberField.Increment aria-label="Increase">+</NumberField.Increment>
        </NumberField.Root>
      </fieldset>
    </Field.Root>
    <Fieldset.Root v-else :disabled="scene.disabled">
      <template #element="{ props, elementRef }">
        <div v-bind="props" :ref="elementRef">
          <NumberField.Root name="amount" :default-value="5">
            <NumberField.Decrement aria-label="Decrease">−</NumberField.Decrement>
            <NumberField.Input aria-label="Amount" />
            <NumberField.Increment aria-label="Increase">+</NumberField.Increment>
          </NumberField.Root>
        </div>
      </template>
    </Fieldset.Root>
  </form>
</template>
