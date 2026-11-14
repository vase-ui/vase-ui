<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';
import { OTPField } from '@vase-ui/vue/otp-field';

const props = withDefaults(
  defineProps<{
    label?: 'none' | 'before' | 'after' | 'native';
    description?: boolean;
    inputs?: number;
    mask?: boolean;
    defaultValue?: string | undefined;
    value?: string | undefined;
    disabled?: boolean;
    readOnly?: boolean;
    required?: boolean;
    name?: string | undefined;
    id?: string | undefined;
    validationType?: 'numeric' | 'alpha' | 'alphanumeric' | 'none';
  }>(),
  {
    label: 'none',
    inputs: 0,
    defaultValue: undefined,
    value: undefined,
    name: undefined,
    id: undefined,
    validationType: 'numeric',
  },
);

function rootProps() {
  return {
    length: 4,
    defaultValue: props.defaultValue,
    value: props.value,
    disabled: props.disabled,
    readOnly: props.readOnly,
    mask: props.mask,
    required: props.required,
    name: props.name,
    id: props.id,
    validationType: props.validationType,
  };
}
</script>

<template>
  <form data-testid="form">
    <Field.Root>
      <Field.Label v-if="label === 'before'" data-testid="label">Code</Field.Label>
      <label v-if="label === 'native'" data-testid="label">
        Code
        <OTPField.Root data-testid="root" v-bind="rootProps()">
          <OTPField.Input v-for="index in inputs" :key="index" />
        </OTPField.Root>
      </label>
      <OTPField.Root v-else data-testid="root" v-bind="rootProps()">
        <OTPField.Input v-for="index in inputs" :key="index" />
      </OTPField.Root>
      <Field.Label v-if="label === 'after'" data-testid="label">Code</Field.Label>
      <Field.Description v-if="description" data-testid="description">Enter it.</Field.Description>
    </Field.Root>
  </form>
</template>
