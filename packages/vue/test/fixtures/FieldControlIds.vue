<script setup lang="ts">
import type { PropType } from 'vue';
import { Checkbox } from '../../src/checkbox';
import { Combobox } from '../../src/combobox';
import { DateField } from '../../src/date-field';
import { Field } from '../../src/field';
import { Input } from '../../src/input';
import { NumberField } from '../../src/number-field';
import { OTPField } from '../../src/otp-field';
import { Radio } from '../../src/radio';
import { RadioGroup } from '../../src/radio-group';
import { Select } from '../../src/select';
import { Switch } from '../../src/switch';

export type ControlKind =
  | 'input'
  | 'input-element-slot'
  | 'checkbox'
  | 'switch'
  | 'radio'
  | 'number-field'
  | 'select'
  | 'select-trigger'
  | 'combobox'
  | 'date-field'
  | 'otp-field';
export type LabelPlace = 'before' | 'after' | 'none' | 'around';

// A control with the `id` "own" in a field, with a `Field.Label` before it, after it, around it or
// none. A radio has its label in a `Field.Item`. `select-trigger` gives the `id` to the trigger.
defineProps({
  control: { type: String as PropType<ControlKind>, required: true },
  label: { type: String as PropType<LabelPlace>, required: true },
});
</script>

<template>
  <Field.Root name="field">
    <component :is="control === 'radio' ? RadioGroup : 'div'" default-value="a">
      <component :is="control === 'radio' ? Field.Item : 'div'">
        <Field.Label v-if="label === 'before'">Name</Field.Label>
        <component :is="label === 'around' ? Field.Label : 'div'">
          <Input v-if="control === 'input'" id="own" />
          <Input v-else-if="control === 'input-element-slot'" id="own">
            <template #element="{ props, elementRef }">
              <input v-bind="props" :ref="elementRef" />
            </template>
          </Input>
          <Checkbox v-else-if="control === 'checkbox'" id="own" />
          <Switch v-else-if="control === 'switch'" id="own" />
          <Radio v-else-if="control === 'radio'" id="own" value="a" />
          <NumberField.Root v-else-if="control === 'number-field'">
            <NumberField.Input id="own" />
          </NumberField.Root>
          <Select.Root v-else-if="control === 'select'" id="own">
            <Select.Trigger><Select.Value placeholder="Pick" /></Select.Trigger>
          </Select.Root>
          <Select.Root v-else-if="control === 'select-trigger'">
            <Select.Trigger id="own"><Select.Value placeholder="Pick" /></Select.Trigger>
          </Select.Root>
          <DateField.Root v-else-if="control === 'date-field'" id="own">
            <DateField.Input />
          </DateField.Root>
          <OTPField.Root v-else-if="control === 'otp-field'" id="own" :length="2">
            <OTPField.Input />
            <OTPField.Input />
          </OTPField.Root>
          <Combobox.Root v-else :items="['a']">
            <Combobox.Input id="own" />
          </Combobox.Root>
          <template v-if="label === 'around'">Name</template>
        </component>
        <Field.Label v-if="label === 'after'">Name</Field.Label>
      </component>
    </component>
  </Field.Root>
</template>
