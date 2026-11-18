<script setup lang="ts">
import { shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Switch } from '@vase-ui/vue/switch';
import type { SwitchRootChangeEventDetails } from '@vase-ui/vue/switch';

const props = withDefaults(
  defineProps<{
    // `model` binds `v-model`. `keeps` gives `checked` and keeps it for each change.
    // `field` is an uncontrolled switch in a `Field.Root`.
    mode?: 'uncontrolled' | 'model' | 'keeps' | 'field';
    defaultChecked?: boolean;
    checked?: boolean | undefined;
    readOnly?: boolean;
    disabled?: boolean;
  }>(),
  { mode: 'uncontrolled', checked: undefined },
);

const model = shallowRef(props.checked);
const changes = shallowRef<string[]>([]);

function switchProps() {
  switch (props.mode) {
    case 'model':
      return {
        modelValue: model.value,
        'onUpdate:modelValue': (checked: boolean) => {
          model.value = checked;
        },
      };
    case 'keeps':
      return { modelValue: model.value };
    default:
      return {
        defaultChecked: props.defaultChecked,
        readOnly: props.readOnly,
        disabled: props.disabled,
      };
  }
}

function handleCheckedChange(checked: boolean, details: SwitchRootChangeEventDetails) {
  changes.value = [...changes.value, `${checked} (${details.event.type})`];
}
</script>

<template>
  <form data-testid="form" @submit.prevent>
    <component :is="mode === 'field' ? Field.Root : 'div'" data-testid="field">
      <label data-testid="label">
        <Switch.Root
          v-bind="switchProps()"
          data-testid="switch"
          @checked-change="handleCheckedChange"
        />
        Notifications
      </label>
    </component>
  </form>
  <output data-testid="model">{{ model }}</output>
  <output data-testid="changes">{{ changes.join('; ') }}</output>
</template>
