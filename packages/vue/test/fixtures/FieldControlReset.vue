<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Checkbox } from '../../src/checkbox';
import { CheckboxGroup } from '../../src/checkbox-group';
import { Combobox } from '../../src/combobox';
import { DateField } from '../../src/date-field';
import { DatePicker } from '../../src/date-picker';
import { Field } from '../../src/field';
import { Input } from '../../src/input';
import { NumberField } from '../../src/number-field';
import { OTPField } from '../../src/otp-field';
import { Radio } from '../../src/radio';
import { RadioGroup } from '../../src/radio-group';
import { Select } from '../../src/select';
import { Slider } from '../../src/slider';
import { Switch } from '../../src/switch';

export type ResetControl =
  | 'Input'
  | 'Checkbox'
  | 'Switch'
  | 'RadioGroup'
  | 'CheckboxGroup'
  | 'NumberField'
  | 'Slider'
  | 'OTPField'
  | 'Select'
  | 'Combobox'
  | 'DateField'
  | 'DatePicker';

// One control in a field, in a native form. `control` gets the attributes of its root, such as
// the model and its update.
defineProps({
  name: { type: String as PropType<ResetControl>, required: true },
  control: { type: Object as PropType<Record<string, unknown>>, required: true },
  field: Object as PropType<Record<string, unknown>>,
});
const fieldRoot = useTemplateRef('fieldRoot');
defineExpose({ field: fieldRoot });
</script>

<template>
  <form>
    <Field.Root ref="fieldRoot" data-testid="field" v-bind="field">
      <Input v-if="name === 'Input'" v-bind="control" />
      <Checkbox v-else-if="name === 'Checkbox'" v-bind="control" />
      <Switch v-else-if="name === 'Switch'" v-bind="control" />
      <RadioGroup v-else-if="name === 'RadioGroup'" v-bind="control">
        <Radio value="a" aria-label="A" />
        <Radio value="b" aria-label="B" />
      </RadioGroup>
      <CheckboxGroup v-else-if="name === 'CheckboxGroup'" v-bind="control">
        <Checkbox value="a" aria-label="A" />
        <Checkbox value="b" aria-label="B" />
      </CheckboxGroup>
      <NumberField.Root v-else-if="name === 'NumberField'" v-bind="control">
        <NumberField.Input />
      </NumberField.Root>
      <Slider.Root v-else-if="name === 'Slider'" v-bind="control">
        <Slider.Control>
          <Slider.Track><Slider.Thumb aria-label="Size" /></Slider.Track>
        </Slider.Control>
      </Slider.Root>
      <OTPField.Root v-else-if="name === 'OTPField'" :length="2" v-bind="control">
        <OTPField.Input />
        <OTPField.Input />
      </OTPField.Root>
      <Select.Root v-else-if="name === 'Select'" v-bind="control">
        <Select.Trigger><Select.Value /></Select.Trigger>
      </Select.Root>
      <Combobox.Root v-else-if="name === 'Combobox'" :items="['a', 'b']" v-bind="control">
        <Combobox.Input />
      </Combobox.Root>
      <DateField.Root v-else-if="name === 'DateField'" v-bind="control">
        <DateField.Input />
      </DateField.Root>
      <DatePicker.Root v-else v-bind="control">
        <DatePicker.Field><DateField.Input /></DatePicker.Field>
      </DatePicker.Root>
    </Field.Root>
  </form>
</template>
