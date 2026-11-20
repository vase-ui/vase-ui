<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { DateField } from '../../src/date-field';
import { DateRangePicker } from '../../src/date-range-picker';
import { Field } from '../../src/field';
import { Form } from '../../src/form';
import { Popover } from '../../src/popover';
import PickerCalendarGrid from './PickerCalendarGrid.vue';
import TestField from './TestField.vue';

type Props = Record<string, unknown>;

// A date range picker in a form, between an input before it and a button outside at the bottom
// right. Each prop goes to the part of its name. `fieldRoot` puts the picker in a `Field.Root`
// with a label.
defineProps({
  root: Object as PropType<Props>,
  start: Object as PropType<Props>,
  end: Object as PropType<Props>,
  trigger: Object as PropType<Props>,
  positioner: Object as PropType<Props>,
  popup: Object as PropType<Props>,
  calendar: Object as PropType<Props>,
  fieldRoot: Object as PropType<Props>,
  vaseForm: Boolean,
  /** Renders a `Field.Error` with this `match`. */
  match: String as PropType<'badInput' | 'rangeUnderflow'>,
  noFields: Boolean,
  fieldsetDisabled: Boolean,
});
const rootPart = useTemplateRef('rootPart');
const startPart = useTemplateRef('startPart');
const endPart = useTemplateRef('endPart');
defineExpose({ root: rootPart, start: startPart, end: endPart });
</script>

<template>
  <component :is="vaseForm ? Form : 'form'">
    <input id="before" aria-label="Before" />
    <fieldset :disabled="fieldsetDisabled">
      <TestField :field="fieldRoot">
        <DateRangePicker.Root ref="rootPart" v-bind="root">
          <template v-if="!noFields">
            <DateRangePicker.StartField ref="startPart" data-testid="start" v-bind="start">
              <DateField.Input />
            </DateRangePicker.StartField>
            <DateRangePicker.EndField ref="endPart" data-testid="end" v-bind="end">
              <DateField.Input />
            </DateRangePicker.EndField>
          </template>
          <DateRangePicker.Trigger data-testid="trigger" v-bind="trigger">
            <template #default="{ text }">{{ text ?? 'Choose' }}</template>
          </DateRangePicker.Trigger>
          <Popover.Portal>
            <DateRangePicker.Positioner data-testid="positioner" v-bind="positioner">
              <DateRangePicker.Popup data-testid="popup" aria-label="Choose dates" v-bind="popup">
                <DateRangePicker.Calendar v-bind="calendar">
                  <PickerCalendarGrid />
                </DateRangePicker.Calendar>
              </DateRangePicker.Popup>
            </DateRangePicker.Positioner>
          </Popover.Portal>
        </DateRangePicker.Root>
        <Field.Error v-if="match" :match="match" data-testid="match">Check the dates.</Field.Error>
      </TestField>
    </fieldset>
    <button type="submit">Submit</button>
    <button type="reset">Reset</button>
  </component>
  <button id="outside" style="position: fixed; right: 0; bottom: 0">Outside</button>
</template>
