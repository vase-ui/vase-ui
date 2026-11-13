<script setup lang="ts">
import { Checkbox } from '@vase-ui/vue/checkbox';
import { Field } from '@vase-ui/vue/field';
import LabelableLabel from '../../../test/fixtures/LabelableLabel.vue';
import LabelableScope from '../../../test/fixtures/LabelableScope.vue';

const props = withDefaults(
  defineProps<{
    label?: 'aria-label' | 'native' | 'before' | 'after' | 'field';
    defaultChecked?: boolean;
    checked?: boolean | undefined;
    indeterminate?: boolean;
    disabled?: boolean;
    readOnly?: boolean;
    required?: boolean;
    nativeButton?: boolean;
    id?: string | undefined;
    name?: string | undefined;
    value?: string | undefined;
    uncheckedValue?: string | undefined;
  }>(),
  {
    label: 'aria-label',
    checked: undefined,
    id: undefined,
    name: undefined,
    value: undefined,
    uncheckedValue: undefined,
  },
);

function checkboxProps() {
  return {
    as: props.nativeButton ? 'button' : undefined,
    nativeButton: props.nativeButton,
    defaultChecked: props.defaultChecked,
    checked: props.checked,
    indeterminate: props.indeterminate,
    disabled: props.disabled,
    readOnly: props.readOnly,
    required: props.required,
    id: props.id,
    name: props.name,
    value: props.value,
    uncheckedValue: props.uncheckedValue,
  };
}
</script>

<template>
  <form data-testid="form">
    <Field.Root v-if="label === 'field'">
      <Field.Label data-testid="label">Notifications</Field.Label>
      <Checkbox.Root data-testid="checkbox" v-bind="checkboxProps()" />
    </Field.Root>
    <label v-else-if="label === 'native'" data-testid="label">
      <Checkbox.Root data-testid="checkbox" v-bind="checkboxProps()" />
      Notifications
    </label>
    <LabelableScope v-else>
      <LabelableLabel v-if="label === 'before'" data-testid="label">Notifications</LabelableLabel>
      <Checkbox.Root
        data-testid="checkbox"
        :aria-label="label === 'aria-label' ? 'Notifications' : undefined"
        v-bind="checkboxProps()"
      />
      <LabelableLabel v-if="label === 'after'" data-testid="label">Notifications</LabelableLabel>
    </LabelableScope>
  </form>
</template>
