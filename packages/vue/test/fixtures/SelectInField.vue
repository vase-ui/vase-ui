<script setup lang="ts">
import type { PropType } from 'vue';
import { Field } from '../../src/field';
import { Form } from '../../src/form';
import { Select } from '../../src/select';

type Attrs = Record<string, unknown>;

// A select in a `Field` in a native form, in a `<fieldset>`. With `vaseForm`, the form is
// `Form`. With `noField`, the select is in the form with no field. `show.b: false` removes the item
// `b` of the field.
defineProps({
  form: Object as PropType<Attrs>,
  show: { type: Object as PropType<{ b?: boolean }>, default: () => ({}) },
  field: Object as PropType<Attrs>,
  root: Object as PropType<Attrs>,
  fieldset: Object as PropType<Attrs>,
  noField: Boolean,
  vaseForm: Boolean,
});
</script>

<template>
  <component :is="vaseForm ? Form : 'form'" id="form" v-bind="form">
    <fieldset v-bind="fieldset">
      <Select.Root v-if="noField" v-bind="root">
        <Select.Trigger data-testid="trigger"><Select.Value /></Select.Trigger>
        <Select.Portal>
          <Select.Positioner :align-item-with-trigger="false">
            <Select.Popup data-testid="popup">
              <Select.Item value="a" data-testid="item-a">A</Select.Item>
              <Select.Item :value="'b\nline'" data-testid="item-b">B</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
      <Field.Root v-else v-bind="field">
        <Field.Label>Letter</Field.Label>
        <Select.Root v-bind="root">
          <Select.Trigger data-testid="trigger"><Select.Value /></Select.Trigger>
          <Select.Portal>
            <Select.Positioner :align-item-with-trigger="false">
              <Select.Popup data-testid="popup">
                <Select.Item value="a" data-testid="item-a">A</Select.Item>
                <Select.Item v-if="show.b !== false" :value="'b\nline'" data-testid="item-b"
                  >B</Select.Item
                >
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
        <Field.Description id="description">Pick a letter.</Field.Description>
        <Field.Error id="error" />
      </Field.Root>
    </fieldset>
    <button id="submit-button">Submit</button>
    <button id="reset-button" type="reset">Reset</button>
  </component>
  <input id="outside" aria-label="Outside" />
</template>
