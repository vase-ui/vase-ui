<script setup lang="ts">
import type { PropType } from 'vue';
import { Combobox } from '../../src/combobox';
import { Field } from '../../src/field';
import { Form } from '../../src/form';

type Props = Record<string, unknown>;

// A combobox in a `Field.Root` with a label, a description and an error, in a `Form`. With
// `inputInPopup`, the trigger is the control and the input is in the popup. `comboboxLabel` adds a
// `Combobox.Label`, and `fieldLabel` false leaves out the label of the field.
defineProps({
  form: Object as PropType<Props>,
  field: Object as PropType<Props>,
  root: Object as PropType<Props>,
  trigger: Object as PropType<Props>,
  items: { type: Array as PropType<unknown[]>, default: () => ['Apple', 'Banana', 'Cherry'] },
  inputInPopup: Boolean,
  comboboxLabel: Boolean,
  fieldLabel: { type: Boolean, default: true },
});
</script>

<template>
  <Form data-testid="form" v-bind="form">
    <Field.Root data-testid="field" v-bind="field">
      <Field.Label v-if="fieldLabel" data-testid="field-label">Fruit</Field.Label>
      <Combobox.Root :items="items" v-bind="root">
        <Combobox.Label v-if="comboboxLabel" data-testid="combobox-label">Fruit</Combobox.Label>
        <Combobox.Trigger v-if="inputInPopup" data-testid="trigger" v-bind="trigger">
          <Combobox.Value />
        </Combobox.Trigger>
        <Combobox.Input v-else data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup data-testid="popup">
              <Combobox.Input v-if="inputInPopup" data-testid="input" />
              <Combobox.List>
                <template #item="{ item }">
                  <Combobox.Item
                    :value="item"
                    :data-testid="`item-${String((item as any)?.label ?? item)}`"
                  >
                    {{ (item as any)?.label ?? item }}
                  </Combobox.Item>
                </template>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
      <Field.Description data-testid="description">Pick a fruit.</Field.Description>
      <Field.Error data-testid="error" />
    </Field.Root>
    <button data-testid="submit">Submit</button>
  </Form>
  <button data-testid="outside">Outside</button>
</template>
