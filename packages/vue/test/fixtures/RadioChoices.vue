<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Field } from '../../src/field';
import { Form } from '../../src/form';
import { Radio } from '../../src/radio';
import { RadioGroup } from '../../src/radio-group';
import TestField from './TestField.vue';

// Each item is a radio with a label around it, or in a `Field.Item` when `item` is given. Its
// value is `value`, or else its key. With `fieldset`, a disabled native fieldset holds the label.
defineProps({
  group: Object as PropType<Record<string, unknown>>,
  items: {
    type: Array as PropType<
      {
        key: string;
        value?: unknown;
        attrs?: Record<string, unknown>;
        item?: Record<string, unknown>;
        fieldset?: boolean;
      }[]
    >,
    required: true,
  },
  field: Object as PropType<Record<string, unknown>>,
  form: Object as PropType<Record<string, unknown>>,
});
const groupPart = useTemplateRef('groupPart');
defineExpose({ group: groupPart });
</script>

<template>
  <Form v-bind="form">
    <!-- WebKit on macOS gives Tab no button, so a text input stands around the group. -->
    <input id="before" aria-label="Before" />
    <TestField :field="field">
      <RadioGroup ref="groupPart" v-bind="group">
        <template v-for="entry in items" :key="entry.key">
          <Field.Item v-if="entry.item" v-bind="entry.item">
            <Field.Label>{{ entry.key }}</Field.Label>
            <Radio
              :id="entry.key"
              :value="'value' in entry ? entry.value : entry.key"
              v-bind="entry.attrs"
            />
            <Field.Description :id="`${entry.key}-description`">
              About {{ entry.key }}.
            </Field.Description>
          </Field.Item>
          <fieldset v-else-if="entry.fieldset" disabled>
            <label>
              {{ entry.key }}
              <Radio
                :id="entry.key"
                :value="'value' in entry ? entry.value : entry.key"
                v-bind="entry.attrs"
              />
            </label>
          </fieldset>
          <label v-else>
            {{ entry.key }}
            <Radio
              :id="entry.key"
              :value="'value' in entry ? entry.value : entry.key"
              v-bind="entry.attrs"
            />
          </label>
        </template>
      </RadioGroup>
    </TestField>
    <input id="after" aria-label="After" />
    <button type="submit">Submit</button>
    <button type="reset">Reset</button>
  </Form>
</template>
