<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Field } from '../../src/field';
import { OTPField } from '../../src/otp-field';

// A native form with a root that has one slot for each entry of `inputs`. With `field`, a field
// with a label and a description holds the root, and `labelAfter` puts the label after the root.
// `around` puts a text input before and after the root, because WebKit on macOS gives Tab no
// button. `submit` puts a submit button in the form. A fieldset holds the root, disabled with
// `fieldsetDisabled`. `label` puts a native label of the id `code` before the root.
defineProps({
  root: { type: Object as PropType<Record<string, unknown>>, default: () => ({}) },
  inputs: {
    type: Array as PropType<Record<string, unknown>[]>,
    default: () => [{}, {}, {}, {}, {}, {}],
  },
  field: Object as PropType<Record<string, unknown>>,
  labelAfter: Boolean,
  formAttrs: Object as PropType<Record<string, unknown>>,
  around: Boolean,
  submit: Boolean,
  fieldsetDisabled: Boolean,
  label: Boolean,
});
const rootPart = useTemplateRef('rootPart');
const inputParts = useTemplateRef('inputParts');
defineExpose({ root: rootPart, inputs: inputParts });
</script>

<template>
  <form v-bind="formAttrs">
    <input v-if="around" id="before" aria-label="Before" />
    <fieldset :disabled="fieldsetDisabled">
      <label v-if="label" for="code">Code</label>
      <Field.Root v-if="field" v-bind="field">
        <Field.Label v-if="!labelAfter">Code</Field.Label>
        <OTPField.Root ref="rootPart" :length="inputs.length" v-bind="root">
          <OTPField.Input
            v-for="(attrs, index) in inputs"
            :key="index"
            ref="inputParts"
            v-bind="attrs"
          />
        </OTPField.Root>
        <Field.Label v-if="labelAfter">Code</Field.Label>
        <Field.Description id="description">The code that we sent.</Field.Description>
        <Field.Error id="error" />
      </Field.Root>
      <OTPField.Root v-else ref="rootPart" :length="inputs.length" v-bind="root">
        <OTPField.Input
          v-for="(attrs, index) in inputs"
          :key="index"
          ref="inputParts"
          v-bind="attrs"
        />
      </OTPField.Root>
    </fieldset>
    <input v-if="around" id="after" aria-label="After" />
    <button v-if="submit" type="submit">Submit</button>
    <button type="reset">Reset</button>
  </form>
</template>
