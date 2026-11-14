<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';
import { NumberField } from '@vase-ui/vue/number-field';

const props = withDefaults(
  defineProps<{
    inField?: boolean;
    value?: number | null | undefined;
    defaultValue?: number | undefined;
    locale?: string | undefined;
    format?: Intl.NumberFormatOptions | undefined;
    name?: string | undefined;
    min?: number | undefined;
    max?: number | undefined;
    step?: number | 'any' | undefined;
    required?: boolean;
    disabled?: boolean;
    readOnly?: boolean;
  }>(),
  {
    value: undefined,
    defaultValue: undefined,
    locale: undefined,
    format: undefined,
    name: undefined,
    min: undefined,
    max: undefined,
    step: undefined,
  },
);

function rootProps() {
  return {
    value: props.value,
    defaultValue: props.defaultValue,
    locale: props.locale,
    format: props.format,
    name: props.name,
    min: props.min,
    max: props.max,
    step: props.step,
    required: props.required,
    disabled: props.disabled,
    readOnly: props.readOnly,
  };
}
</script>

<template>
  <form data-testid="form">
    <component :is="inField ? Field.Root : 'div'">
      <NumberField.Root data-testid="root" v-bind="rootProps()">
        <template #default="{ state }">
          <NumberField.Group data-testid="group">
            <NumberField.Decrement data-testid="decrement" />
            <span data-testid="text">{{ state.inputValue }}</span>
            <NumberField.Increment data-testid="increment" />
          </NumberField.Group>
        </template>
      </NumberField.Root>
    </component>
  </form>
</template>
