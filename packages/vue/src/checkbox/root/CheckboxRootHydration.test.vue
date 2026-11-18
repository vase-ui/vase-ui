<script setup lang="ts">
import { onMounted, shallowRef } from 'vue';
import { Checkbox } from '@vase-ui/vue/checkbox';
import { Field } from '@vase-ui/vue/field';
import LabelableLabel from '../../../test/fixtures/LabelableLabel.vue';
import LabelableScope from '../../../test/fixtures/LabelableScope.vue';

const props = withDefaults(
  defineProps<{
    label?: 'aria-label' | 'native' | 'before' | 'after' | 'field' | 'field-after';
    descriptionBefore?: boolean;
    laterRemovedAtMount?: boolean;
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

const isMounted = shallowRef(false);
onMounted(() => {
  isMounted.value = true;
});

function checkboxProps() {
  return {
    as: props.nativeButton ? 'button' : undefined,
    nativeButton: props.nativeButton,
    defaultChecked: props.defaultChecked,
    modelValue: props.checked,
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
    <Field.Root v-if="label === 'field' || label === 'field-after'">
      <Field.Label v-if="label === 'field'" data-testid="label">Notifications</Field.Label>
      <Field.Description v-if="descriptionBefore" id="desc-0">Get a mail.</Field.Description>
      <Checkbox.Root data-testid="checkbox" v-bind="checkboxProps()" />
      <template v-if="label === 'field-after' && !(laterRemovedAtMount && isMounted)">
        <Field.Label id="label-a">Notifications</Field.Label>
        <Field.Description id="desc-a">Get a mail.</Field.Description>
      </template>
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
