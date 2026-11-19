<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Checkbox } from '../../src/checkbox';
import { CheckboxGroup } from '../../src/checkbox-group';
import { Field } from '../../src/field';
import { Form } from '../../src/form';
import TestField from './TestField.vue';

// Each item is a checkbox with a label around it, or in a `Field.Item` when `item` is given.
defineProps({
  group: Object as PropType<Record<string, unknown>>,
  items: {
    type: Array as PropType<
      {
        key: string;
        value?: string;
        parent?: boolean;
        attrs?: Record<string, unknown>;
        item?: Record<string, unknown>;
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
    <TestField :field="field">
      <CheckboxGroup ref="groupPart" v-bind="group" v-slot="{ state }">
        <span class="state">{{ state.disabled }}</span>
        <template v-for="entry in items" :key="entry.key">
          <Field.Item v-if="entry.item" v-bind="entry.item">
            <Field.Label>{{ entry.key }}</Field.Label>
            <Checkbox
              :id="entry.key"
              :value="entry.value"
              :parent="entry.parent"
              v-bind="entry.attrs"
            />
            <Field.Description :id="`${entry.key}-description`"
              >About {{ entry.key }}.</Field.Description
            >
          </Field.Item>
          <label v-else>
            {{ entry.key }}
            <Checkbox
              :id="entry.key"
              :value="entry.value"
              :parent="entry.parent"
              v-bind="entry.attrs"
            />
          </label>
        </template>
      </CheckboxGroup>
    </TestField>
    <button type="submit">Submit</button>
    <button type="reset">Reset</button>
  </Form>
</template>
