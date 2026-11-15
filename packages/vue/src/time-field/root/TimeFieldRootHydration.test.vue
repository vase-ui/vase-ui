<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';
import { TimeField } from '@vase-ui/vue/time-field';

// The props of a server render go to Node as JSON, so a time is a text and the fixture makes it.
const props = withDefaults(
  defineProps<{
    label?: 'none' | 'before' | 'after';
    description?: boolean;
    defaultValue?: string | undefined;
    granularity?: 'hour' | 'minute' | 'second' | undefined;
    hourCycle?: 12 | 24 | undefined;
    locale?: string | undefined;
    minTime?: string | undefined;
    maxTime?: string | undefined;
    step?: number | undefined;
    name?: string | undefined;
    required?: boolean;
    clear?: boolean;
    // How the field gives its segments: the default parts, the `segment` slot, or a `#render` slot.
    input?: 'default' | 'segment-slot' | 'render-slot';
  }>(),
  {
    label: 'none',
    defaultValue: undefined,
    granularity: undefined,
    hourCycle: undefined,
    locale: undefined,
    minTime: undefined,
    maxTime: undefined,
    step: undefined,
    name: undefined,
    input: 'default',
  },
);

type Time = Temporal.PlainTime | Temporal.PlainDateTime | Temporal.ZonedDateTime;

// The kind of a text follows its form.
function toTime(text: string | undefined): Time | undefined {
  if (text === undefined) {
    return undefined;
  }
  if (text.includes('[')) {
    return Temporal.ZonedDateTime.from(text);
  }
  return text.includes('T') ? Temporal.PlainDateTime.from(text) : Temporal.PlainTime.from(text);
}

function rootProps() {
  return {
    defaultValue: toTime(props.defaultValue),
    granularity: props.granularity,
    hourCycle: props.hourCycle,
    locale: props.locale,
    minTime: props.minTime === undefined ? undefined : Temporal.PlainTime.from(props.minTime),
    maxTime: props.maxTime === undefined ? undefined : Temporal.PlainTime.from(props.maxTime),
    step: props.step,
    name: props.name,
    required: props.required,
  };
}
</script>

<template>
  <form data-testid="form">
    <Field.Root>
      <Field.Label v-if="label === 'before'" data-testid="label">Alarm</Field.Label>
      <TimeField.Root data-testid="root" v-bind="rootProps()">
        <TimeField.Input v-if="input === 'default'" data-testid="input" />
        <TimeField.Input v-else-if="input === 'segment-slot'" data-testid="input">
          <template #segment="{ segment }">
            <TimeField.Segment v-if="segment.editable" :segment="segment" class="segment" />
            <TimeField.Literal v-else :segment="segment" class="literal" />
          </template>
        </TimeField.Input>
        <TimeField.Input v-else data-testid="input">
          <template #render="{ props: inputProps, children }">
            <section v-bind="inputProps"><component :is="children" /></section>
          </template>
        </TimeField.Input>
        <TimeField.Clear v-if="clear" data-testid="clear" />
      </TimeField.Root>
      <Field.Label v-if="label === 'after'" data-testid="label">Alarm</Field.Label>
      <Field.Description v-if="description" data-testid="description">
        Pick a time.
      </Field.Description>
    </Field.Root>
  </form>
</template>
