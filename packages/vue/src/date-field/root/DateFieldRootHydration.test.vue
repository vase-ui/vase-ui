<script setup lang="ts">
import { DateField } from '@vase-ui/vue/date-field';
import { Field } from '@vase-ui/vue/field';
import type { DateFieldRootValue } from './DateFieldRoot.vue';

// The props of a server render go to Node as JSON, so a value is a text. The form of the text gives
// the kind of the value.
const props = withDefaults(
  defineProps<{
    value?: string | undefined;
    defaultValue?: string | undefined;
    referenceDate?: string | undefined;
    granularity?: 'month' | 'day' | 'hour' | 'minute' | 'second' | undefined;
    minDate?: string | undefined;
    maxDate?: string | undefined;
    locale?: string | undefined;
    calendar?: string | undefined;
    timeZone?: string | undefined;
    hourCycle?: 12 | 24 | undefined;
    name?: string | undefined;
    id?: string | undefined;
    disabled?: boolean;
    readOnly?: boolean;
    required?: boolean;
    label?: 'none' | 'before' | 'after' | 'native';
    clear?: boolean;
    useSegmentSlot?: boolean;
    useRenderSlot?: boolean;
  }>(),
  {
    value: undefined,
    defaultValue: undefined,
    referenceDate: undefined,
    granularity: undefined,
    minDate: undefined,
    maxDate: undefined,
    locale: undefined,
    calendar: undefined,
    timeZone: undefined,
    hourCycle: undefined,
    name: undefined,
    id: undefined,
    label: 'none',
  },
);

function toValue(text: string | undefined): DateFieldRootValue | undefined {
  if (text === undefined) {
    return undefined;
  }
  if (text.includes('[')) {
    return Temporal.ZonedDateTime.from(text);
  }
  if (text.includes('T')) {
    return Temporal.PlainDateTime.from(text);
  }
  return /^\d{4}-\d{2}$/.test(text)
    ? Temporal.PlainYearMonth.from(text)
    : Temporal.PlainDate.from(text);
}

function toDate(text: string | undefined) {
  return text === undefined ? undefined : Temporal.PlainDate.from(text);
}

function rootProps() {
  return {
    value: toValue(props.value),
    defaultValue: toValue(props.defaultValue),
    referenceDate: toValue(props.referenceDate),
    granularity: props.granularity,
    minDate: toDate(props.minDate),
    maxDate: toDate(props.maxDate),
    locale: props.locale,
    calendar: props.calendar,
    timeZone: props.timeZone,
    hourCycle: props.hourCycle,
    name: props.name,
    id: props.id,
    disabled: props.disabled,
    readOnly: props.readOnly,
    required: props.required,
  };
}
</script>

<template>
  <form data-testid="form">
    <Field.Root>
      <Field.Label v-if="label === 'before'" data-testid="label">Date</Field.Label>
      <label v-if="label === 'native'" data-testid="label" :for="id">Date</label>
      <DateField.Root data-testid="root" v-bind="rootProps()">
        <DateField.Input v-if="useRenderSlot" data-testid="input">
          <template #render="{ props: inputProps, children }">
            <div v-bind="inputProps"><component :is="children" /></div>
          </template>
        </DateField.Input>
        <DateField.Input v-else-if="!useSegmentSlot" data-testid="input" />
        <DateField.Input v-else data-testid="input">
          <template #segment="{ segment }">
            <DateField.Segment v-if="segment.editable" :segment="segment" />
            <DateField.Literal v-else :segment="segment" />
          </template>
        </DateField.Input>
        <DateField.Clear v-if="clear" data-testid="clear" />
      </DateField.Root>
      <Field.Label v-if="label === 'after'" data-testid="label">Date</Field.Label>
    </Field.Root>
  </form>
</template>
