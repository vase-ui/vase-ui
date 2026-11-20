<script setup lang="ts">
import type { PropType } from 'vue';
import { DateField } from '../../src/date-field';
import { Field } from '../../src/field';
import { Form } from '../../src/form';
import TestField from './TestField.vue';

defineProps({
  field: Object as PropType<Record<string, unknown>>,
  date: Object as PropType<Record<string, unknown>>,
  /** A native label of the field: `for` names the first segment, `around` holds the field. */
  label: String as PropType<'for' | 'around'>,
  formAttrs: Object as PropType<Record<string, unknown>>,
  /** Renders `Form` in place of a native form. */
  vaseForm: Boolean,
  /** The fieldset around the field is disabled. */
  fieldsetDisabled: Boolean,
  /** Renders a `Field.Error` with this `match`. */
  match: String as PropType<'badInput' | 'rangeUnderflow' | 'rangeOverflow' | 'customError'>,
});
</script>

<template>
  <component :is="vaseForm ? Form : 'form'" v-bind="formAttrs">
    <fieldset :disabled="fieldsetDisabled">
      <TestField :field="field">
        <label v-if="label === 'around'">
          Birthday
          <DateField.Root v-bind="date"><DateField.Input /></DateField.Root>
        </label>
        <template v-else>
          <label v-if="label === 'for'" :for="String(date?.id ?? 'day')">Birthday</label>
          <DateField.Root v-bind="date">
            <DateField.Input />
            <DateField.Clear aria-label="Clear">×</DateField.Clear>
          </DateField.Root>
        </template>
        <Field.Error v-if="match" :match="match" data-testid="match"
          >Choose another day.</Field.Error
        >
      </TestField>
    </fieldset>
    <button type="submit">Submit</button>
    <button type="reset">Reset</button>
  </component>
</template>
