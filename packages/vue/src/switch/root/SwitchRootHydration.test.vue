<script setup lang="ts">
import { Switch } from '@vase-ui/vue/switch';
import LabelableLabel from '../../../test/fixtures/LabelableLabel.vue';
import LabelableScope from '../../../test/fixtures/LabelableScope.vue';

const props = withDefaults(
  defineProps<{
    label?: 'aria-label' | 'native' | 'before' | 'after';
    defaultChecked?: boolean;
    checked?: boolean | undefined;
    disabled?: boolean;
    readOnly?: boolean;
    required?: boolean;
    nativeButton?: boolean;
    name?: string | undefined;
    value?: string | undefined;
    uncheckedValue?: string | undefined;
  }>(),
  {
    label: 'aria-label',
    checked: undefined,
    name: undefined,
    value: undefined,
    uncheckedValue: undefined,
  },
);

function switchProps() {
  return {
    as: props.nativeButton ? 'button' : undefined,
    nativeButton: props.nativeButton,
    defaultChecked: props.defaultChecked,
    checked: props.checked,
    disabled: props.disabled,
    readOnly: props.readOnly,
    required: props.required,
    name: props.name,
    value: props.value,
    uncheckedValue: props.uncheckedValue,
  };
}
</script>

<template>
  <form data-testid="form">
    <label v-if="label === 'native'" data-testid="label">
      <Switch.Root data-testid="switch" v-bind="switchProps()">
        <Switch.Thumb data-testid="thumb" />
      </Switch.Root>
      Notifications
    </label>
    <LabelableScope v-else>
      <LabelableLabel v-if="label === 'before'" data-testid="label">Notifications</LabelableLabel>
      <Switch.Root
        data-testid="switch"
        :aria-label="label === 'aria-label' ? 'Notifications' : undefined"
        v-bind="switchProps()"
      >
        <Switch.Thumb data-testid="thumb" />
      </Switch.Root>
      <LabelableLabel v-if="label === 'after'" data-testid="label">Notifications</LabelableLabel>
    </LabelableScope>
  </form>
</template>
