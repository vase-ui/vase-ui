<script setup lang="ts">
import { ref, type PropType } from 'vue';
import { Checkbox } from '../../src/checkbox';
import { CheckboxGroup } from '../../src/checkbox-group';
import { Field } from '../../src/field';
import { Form, type FormValues } from '../../src/form';
import { Input } from '../../src/input';
import { Radio } from '../../src/radio';
import { RadioGroup } from '../../src/radio-group';
import { Switch } from '../../src/switch';

// A form with a field of each control. Each submit that passes gives its values to `saves`.
const props = defineProps({
  saves: {
    type: Object as PropType<{ add(prevented: boolean, values: FormValues): void }>,
    required: true,
  },
});
const city = ref('Lyon');

function save(event: SubmitEvent, values: FormValues) {
  props.saves.add(event.defaultPrevented, values);
}
</script>

<template>
  <Form @submit="save">
    <Field.Root name="name">
      <Field.Label>Name</Field.Label>
      <Input default-value="Ada" />
    </Field.Root>
    <Field.Root name="city">
      <Field.Label>City</Field.Label>
      <Input v-model="city" />
    </Field.Root>
    <Field.Root name="terms">
      <Field.Label>Terms</Field.Label>
      <Checkbox default-checked />
    </Field.Root>
    <Field.Root name="news">
      <Field.Label>News</Field.Label>
      <Switch />
    </Field.Root>
    <Field.Root name="fruits">
      <Field.Label>Fruits</Field.Label>
      <CheckboxGroup :default-value="['apple', 'kiwi']">
        <Checkbox value="apple" aria-label="Apple" />
        <Checkbox value="pear" aria-label="Pear" />
        <Checkbox value="kiwi" aria-label="Kiwi" disabled />
      </CheckboxGroup>
    </Field.Root>
    <Field.Root name="size">
      <Field.Label>Size</Field.Label>
      <RadioGroup :default-value="2">
        <Radio :value="1" aria-label="One" />
        <Radio :value="2" aria-label="Two" />
      </RadioGroup>
    </Field.Root>
    <Field.Root name="plan">
      <Field.Label>Plan</Field.Label>
      <RadioGroup default-value="pro">
        <Radio value="free" aria-label="Free" />
        <Radio value="pro" aria-label="Pro" disabled />
      </RadioGroup>
    </Field.Root>
    <Field.Root name="code" disabled>
      <Field.Label>Code</Field.Label>
      <Input default-value="x" />
    </Field.Root>
    <Field.Root name="name">
      <Field.Label>Other name</Field.Label>
      <Input default-value="Grace" />
    </Field.Root>
    <input name="native" value="n" aria-label="Native" />
    <button type="submit">Submit</button>
  </Form>
  <Field.Root name="outside">
    <Field.Label>Outside</Field.Label>
    <Input default-value="o" />
  </Field.Root>
</template>
