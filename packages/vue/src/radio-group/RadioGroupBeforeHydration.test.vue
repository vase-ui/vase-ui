<script setup lang="ts">
import { shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Input } from '@vase-ui/vue/input';
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';
import type { RadioGroupChangeEventDetails } from '@vase-ui/vue/radio-group';

const props = withDefaults(
  defineProps<{
    // `model` binds `v-model`. `keeps` gives `value` and keeps it for each change. `field`
    // is an uncontrolled group in a `Field.Root`.
    mode?: 'uncontrolled' | 'model' | 'keeps' | 'field';
    named?: boolean;
    // An `Input` with `v-model` between the first radio and the other radios.
    textBetween?: boolean;
    // The first value of the model, or the default value.
    value?: string;
    readOnly?: boolean;
    disabled?: boolean;
  }>(),
  { mode: 'uncontrolled' },
);

const model = shallowRef(props.value);
const text = shallowRef('');
const changes = shallowRef<string[]>([]);

function groupProps() {
  switch (props.mode) {
    case 'model':
      return {
        modelValue: model.value,
        'onUpdate:modelValue': (value: string) => {
          model.value = value;
        },
      };
    case 'keeps':
      return { modelValue: model.value };
    default:
      return { defaultValue: props.value };
  }
}

function handleValueChange(value: unknown, details: RadioGroupChangeEventDetails) {
  changes.value = [...changes.value, `${String(value)} (${details.event.type})`];
}
</script>

<template>
  <form data-testid="form" @submit.prevent>
    <component :is="mode === 'field' ? Field.Root : 'div'" data-testid="field">
      <RadioGroup
        :name="named ? 'choice' : undefined"
        :read-only="readOnly"
        :disabled="disabled"
        v-bind="groupProps()"
        data-testid="group"
        @value-change="handleValueChange"
      >
        <label data-testid="label-a"><Radio.Root value="a" data-testid="a" />A</label>
        <Input v-if="textBetween" v-model="text" data-testid="text" />
        <label data-testid="label-b"><Radio.Root value="b" data-testid="b" />B</label>
        <label data-testid="label-c"><Radio.Root value="c" data-testid="c" />C</label>
      </RadioGroup>
    </component>
  </form>
  <output data-testid="model">{{ model }}</output>
  <output data-testid="text-model">{{ text }}</output>
  <output data-testid="changes">{{ changes.join('; ') }}</output>
</template>
