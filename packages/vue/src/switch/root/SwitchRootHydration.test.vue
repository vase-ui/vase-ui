<script setup lang="ts">
import { onMounted, shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Switch } from '@vase-ui/vue/switch';
import LabelableLabel from '../../../test/fixtures/LabelableLabel.vue';
import LabelableScope from '../../../test/fixtures/LabelableScope.vue';

const props = withDefaults(
  defineProps<{
    label?: 'aria-label' | 'native' | 'before' | 'after' | 'field-after';
    laterRemovedAtMount?: boolean;
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

const isMounted = shallowRef(false);
onMounted(() => {
  isMounted.value = true;
});

function switchProps() {
  return {
    as: props.nativeButton ? 'button' : undefined,
    nativeButton: props.nativeButton,
    defaultChecked: props.defaultChecked,
    modelValue: props.checked,
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
    <Field.Root v-if="label === 'field-after'">
      <Switch.Root data-testid="switch" v-bind="switchProps()">
        <Switch.Thumb data-testid="thumb" />
      </Switch.Root>
      <template v-if="!(laterRemovedAtMount && isMounted)">
        <Field.Label id="label-a">Notifications</Field.Label>
        <Field.Description id="desc-a">Get a mail.</Field.Description>
      </template>
    </Field.Root>
    <label v-else-if="label === 'native'" data-testid="label">
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
