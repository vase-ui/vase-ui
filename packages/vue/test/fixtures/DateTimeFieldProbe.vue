<script lang="ts">
import { defineComponent, h } from 'vue';
import type { PropType } from 'vue';
import { useIsHydrating } from '../../src/common/hydration';
import { useDateTimeFieldContext } from '../../src/internals/date-time/field/DateTimeFieldContext';
import {
  segmentStateAttributesMapping,
  useDateTimeFieldSegment,
} from '../../src/internals/date-time/field/useDateTimeFieldSegment';
import type { EditableDateTimeFieldSegment } from '../../src/internals/date-time/field/useDateTimeFieldSegment';
import { useRenderElement } from '../../src/internals/useRenderElement';

// The part that calls `useDateTimeFieldSegment`, as the segment of a date field does.
const ProbeSegment = defineComponent({
  name: 'ProbeSegment',
  inheritAttrs: false,
  props: {
    segment: { type: Object as PropType<EditableDateTimeFieldSegment>, required: true },
  },
  setup(props) {
    const {
      state,
      props: segmentProps,
      setElement,
    } = useDateTimeFieldSegment(() => props.segment, { as: 'input' });
    const { elementProps } = useRenderElement(
      'input',
      {},
      {
        state,
        stateAttributesMapping: segmentStateAttributesMapping,
        ref: setElement,
        props: (attrs) => [segmentProps.value, attrs],
      },
    );
    return () => h('input', elementProps());
  },
});

// The part that renders the items of the layout, as the input of a date field does. Each item is a
// direct child of the element. A server with another number of items then gives a mismatch that
// `data-allow-mismatch="children"` allows. In a fragment, such as the one of `v-for`, Vue logs
// `Hydration completed but contains mismatches` with no check of the attribute.
const ProbeInput = defineComponent({
  name: 'ProbeInput',
  setup() {
    const context = useDateTimeFieldContext();
    const isHydrating = useIsHydrating();
    return () =>
      h(
        'div',
        {
          'data-testid': 'input',
          'data-allow-mismatch': isHydrating.value ? 'children' : undefined,
          onMousedown: context.handleInputPress,
        },
        context.segments.value.map((segment) => {
          const key = `${context.listKey.value}:${segment.index}`;
          return segment.editable
            ? h(ProbeSegment, { key, segment })
            : h(
                'span',
                {
                  key,
                  'data-type': segment.type,
                  'aria-hidden': segment.type === 'literal' ? true : undefined,
                  'data-allow-mismatch': isHydrating.value ? 'text' : undefined,
                },
                segment.text,
              );
        }),
      );
  },
});
</script>

<script setup lang="ts">
import { fieldValidityMapping } from '../../src/internals/field-constants';
import { useTemplateRef } from 'vue';
import type { DateTimeFieldChangeEventDetails } from '../../src/internals/date-time/field/DateTimeFieldContext';
import { useDateTimeFieldRoot } from '../../src/internals/date-time/field/useDateTimeFieldRoot';
import type { DateTimeFieldGranularity } from '../../src/internals/date-time/field/useDateTimeFieldRoot';
import type { DateMatcher } from '../../src/internals/date-time/matchers';
import { assertTemporal } from '../../src/internals/date-time/temporal';
import type { DateValue, TemporalValue } from '../../src/internals/date-time/temporal';

defineOptions({ inheritAttrs: false });

// A test part that renders the two composables of the engine as `DateField` and `TimeField` will.
// A date or a time can be a text, because the props of a server render go to Node as JSON.
type Input = TemporalValue | string | null | undefined;

const props = withDefaults(
  defineProps<{
    family?: 'date' | 'time';
    modelValue?: Input;
    defaultValue?: Input;
    referenceDate?: Input;
    granularity?: DateTimeFieldGranularity | undefined;
    hourCycle?: 12 | 24 | undefined;
    forceLeadingZeros?: boolean;
    hideTimeZone?: boolean;
    minDate?: DateValue | string | undefined;
    maxDate?: DateValue | string | undefined;
    unavailableDates?: DateMatcher | undefined;
    minTime?: Temporal.PlainTime | string | undefined;
    maxTime?: Temporal.PlainTime | string | undefined;
    step?: number | undefined;
    locale?: string | undefined;
    calendar?: string | undefined;
    timeZone?: string | undefined;
    disabled?: boolean;
    readOnly?: boolean;
    required?: boolean;
    name?: string | undefined;
    form?: string | undefined;
    id?: string | undefined;
    autoComplete?: string | undefined;
    ariaLabelledby?: string | undefined;
  }>(),
  {
    family: 'date',
    modelValue: undefined,
    defaultValue: undefined,
    referenceDate: undefined,
    granularity: undefined,
    hourCycle: undefined,
    minDate: undefined,
    maxDate: undefined,
    unavailableDates: undefined,
    minTime: undefined,
    maxTime: undefined,
    step: undefined,
    locale: undefined,
    calendar: undefined,
    timeZone: undefined,
    name: undefined,
    form: undefined,
    id: undefined,
    autoComplete: undefined,
    ariaLabelledby: undefined,
  },
);

const emit = defineEmits<{
  valueChange: [value: TemporalValue | null, details: DateTimeFieldChangeEventDetails];
  'update:modelValue': [value: TemporalValue | null];
}>();

// The kind of a text follows its form.
function toTemporal(input: Input): TemporalValue | null | undefined {
  if (typeof input !== 'string') {
    return input;
  }
  if (input.includes('[')) {
    return Temporal.ZonedDateTime.from(input);
  }
  if (input.includes('T')) {
    return Temporal.PlainDateTime.from(input);
  }
  if (/^\d{4}-\d{2}$/.test(input)) {
    return Temporal.PlainYearMonth.from(input);
  }
  return input.includes(':') ? Temporal.PlainTime.from(input) : Temporal.PlainDate.from(input);
}

function toDate(input: DateValue | string | undefined) {
  return typeof input === 'string' ? Temporal.PlainDate.from(input) : input;
}

function toTime(input: Temporal.PlainTime | string | undefined) {
  return typeof input === 'string' ? Temporal.PlainTime.from(input) : input;
}

assertTemporal('DateTimeFieldProbe');

const inputElement = useTemplateRef<HTMLInputElement>('input');
const root = useDateTimeFieldRoot<TemporalValue>({
  hiddenInputElement: inputElement,
  family: props.family,
  value: () => toTemporal(props.modelValue),
  defaultValue: () => toTemporal(props.defaultValue),
  referenceDate: () => toTemporal(props.referenceDate) ?? undefined,
  granularity: () => props.granularity,
  hourCycle: () => props.hourCycle,
  forceLeadingZeros: () => props.forceLeadingZeros,
  hideTimeZone: () => props.hideTimeZone,
  minDate: () => toDate(props.minDate),
  maxDate: () => toDate(props.maxDate),
  unavailableDates: () => props.unavailableDates,
  minTime: () => toTime(props.minTime),
  maxTime: () => toTime(props.maxTime),
  step: () => props.step,
  locale: () => props.locale,
  calendar: () => props.calendar,
  timeZone: () => props.timeZone,
  disabled: () => props.disabled,
  readOnly: () => props.readOnly,
  required: () => props.required,
  name: () => props.name,
  form: () => props.form,
  id: () => props.id,
  autoComplete: () => props.autoComplete,
  ariaLabelledby: () => props.ariaLabelledby,
  valueChange: (value, details) => emit('valueChange', value, details),
  updateValue: (value) => emit('update:modelValue', value),
});

const { elementProps, setRef } = useRenderElement(
  'div',
  {},
  {
    state: root.state,
    stateAttributesMapping: fieldValidityMapping,
    ref: root.setRootElement,
    props: root.getRootProps,
  },
);

defineExpose({ context: root });
</script>

<template>
  <div v-bind="elementProps()" :ref="setRef">
    <ProbeInput />
    <button
      type="button"
      data-testid="clear"
      :disabled="root.state.value.empty || disabled || readOnly"
      @click="root.clear($event)"
    >
      Clear
    </button>
  </div>
  <input v-bind="root.hiddenInputProps()" ref="input" />
</template>
