<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { DateField } from '../../src/date-field';
import { DatePicker } from '../../src/date-picker';
import { Popover } from '../../src/popover';
import { Form } from '../../src/form';
import { TimeField } from '../../src/time-field';
import PickerCalendarGrid from './PickerCalendarGrid.vue';
import TestField from './TestField.vue';

type Props = Record<string, unknown>;

// A date picker in a form, between an input before it and a button outside at the bottom right.
// Each prop goes to the part of its name. `fieldRoot` puts the picker in a `Field.Root` with a label.
// `timeField` renders `DatePicker.TimeField` in the popup, and `months` a grid of months.
defineProps({
  root: Object as PropType<Props>,
  field: Object as PropType<Props>,
  trigger: Object as PropType<Props>,
  portal: Object as PropType<Props>,
  positioner: Object as PropType<Props>,
  popup: Object as PropType<Props>,
  calendar: Object as PropType<Props>,
  timeField: Object as PropType<Props>,
  fieldRoot: Object as PropType<Props>,
  formAttrs: Object as PropType<Props>,
  /** Renders `Form` in place of a native form. */
  vaseForm: Boolean,
  /** Renders `DatePicker.TimeField` beside the field, with these props. */
  inlineTimeField: Object as PropType<Props>,
  noField: Boolean,
  noTrigger: Boolean,
  months: Boolean,
  fieldsetDisabled: Boolean,
});
const rootPart = useTemplateRef('rootPart');
const fieldPart = useTemplateRef('fieldPart');
const calendarPart = useTemplateRef('calendarPart');
const timeFieldPart = useTemplateRef('timeFieldPart');
defineExpose({
  root: rootPart,
  field: fieldPart,
  calendar: calendarPart,
  timeField: timeFieldPart,
});
</script>

<template>
  <component :is="vaseForm ? Form : 'form'" v-bind="formAttrs">
    <input id="before" aria-label="Before" />
    <fieldset :disabled="fieldsetDisabled">
      <TestField :field="fieldRoot">
        <DatePicker.Root ref="rootPart" v-bind="root">
          <DatePicker.Field v-if="!noField" ref="fieldPart" v-bind="field">
            <DateField.Input />
          </DatePicker.Field>
          <DatePicker.TimeField v-if="inlineTimeField" v-bind="inlineTimeField">
            <TimeField.Input />
          </DatePicker.TimeField>
          <DatePicker.Trigger v-if="!noTrigger" data-testid="trigger" v-bind="trigger">
            <template #default="{ text }">{{ text ?? 'Choose' }}</template>
          </DatePicker.Trigger>
          <Popover.Portal v-bind="portal">
            <DatePicker.Positioner data-testid="positioner" v-bind="positioner">
              <DatePicker.Popup data-testid="popup" aria-label="Choose a date" v-bind="popup">
                <DatePicker.Calendar ref="calendarPart" v-bind="calendar">
                  <PickerCalendarGrid :months="months" />
                </DatePicker.Calendar>
                <DatePicker.TimeField
                  v-if="timeField"
                  ref="timeFieldPart"
                  aria-label="Time"
                  v-bind="timeField"
                >
                  <TimeField.Input />
                </DatePicker.TimeField>
              </DatePicker.Popup>
            </DatePicker.Positioner>
          </Popover.Portal>
        </DatePicker.Root>
      </TestField>
    </fieldset>
    <button type="submit">Submit</button>
    <button type="reset">Reset</button>
  </component>
  <button id="outside" style="position: fixed; right: 0; bottom: 0">Outside</button>
</template>
