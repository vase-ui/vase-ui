<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Form } from '../../src/form';
import { Popover } from '../../src/popover';
import { TimeClock } from '../../src/time-clock';
import { TimeField } from '../../src/time-field';
import { TimePicker, type TimePickerColumnUnit } from '../../src/time-picker';
import TestField from './TestField.vue';

type Props = Record<string, unknown>;

// A time picker in a form, between an input before it and a button outside at the bottom right.
// Each prop goes to the part of its name. `parts` names the parts of the popup in their order:
// `list`, `clock`, or a unit of a column. `listBefore` renders a list before the portal.
defineProps({
  root: Object as PropType<Props>,
  field: Object as PropType<Props>,
  trigger: Object as PropType<Props>,
  portal: Object as PropType<Props>,
  popup: Object as PropType<Props>,
  list: Object as PropType<Props>,
  column: Object as PropType<Props>,
  clock: Object as PropType<Props>,
  parts: {
    type: Array as PropType<('list' | 'clock' | TimePickerColumnUnit)[]>,
    default: () => ['list'],
  },
  fieldRoot: Object as PropType<Props>,
  vaseForm: Boolean,
  listBefore: Boolean,
  noField: Boolean,
  fieldsetDisabled: Boolean,
});
const rootPart = useTemplateRef('rootPart');
const fieldPart = useTemplateRef('fieldPart');
defineExpose({ root: rootPart, field: fieldPart });
</script>

<template>
  <component :is="vaseForm ? Form : 'form'">
    <input id="before" aria-label="Before" />
    <fieldset :disabled="fieldsetDisabled">
      <TestField :field="fieldRoot">
        <TimePicker.Root ref="rootPart" v-bind="root">
          <TimePicker.Field v-if="!noField" ref="fieldPart" v-bind="field">
            <TimeField.Input />
          </TimePicker.Field>
          <TimePicker.Trigger data-testid="trigger" v-bind="trigger">
            <template #default="{ text }">{{ text ?? 'Choose' }}</template>
          </TimePicker.Trigger>
          <TimePicker.List v-if="listBefore" data-testid="list-before" aria-label="Times" />
          <Popover.Portal v-bind="portal">
            <TimePicker.Positioner data-testid="positioner">
              <TimePicker.Popup data-testid="popup" aria-label="Choose a time" v-bind="popup">
                <template v-for="part in parts" :key="part">
                  <TimePicker.List
                    v-if="part === 'list'"
                    data-testid="list"
                    aria-label="Times"
                    v-bind="list"
                  />
                  <TimePicker.Clock v-else-if="part === 'clock'" data-testid="clock" v-bind="clock">
                    <TimeClock.Face data-testid="face" />
                  </TimePicker.Clock>
                  <TimePicker.Column v-else :unit="part" :data-testid="part" v-bind="column" />
                </template>
              </TimePicker.Popup>
            </TimePicker.Positioner>
          </Popover.Portal>
        </TimePicker.Root>
      </TestField>
    </fieldset>
    <button type="submit">Submit</button>
    <button type="reset">Reset</button>
  </component>
  <button id="outside" style="position: fixed; right: 0; bottom: 0">Outside</button>
</template>
