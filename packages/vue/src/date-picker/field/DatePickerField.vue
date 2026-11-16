<script lang="ts">
import type {
  DateFieldRootProps,
  DateFieldRootState,
} from '../../date-field/root/DateFieldRoot.vue';

export interface DatePickerFieldState extends DateFieldRootState {}

/**
 * The props of `DateField.Root` that the picker does not own. The root of the picker owns the
 * value, the limits, the locale, the calendar, the time zone and the props of the form.
 */
export interface DatePickerFieldProps extends Omit<
  DateFieldRootProps,
  | 'value'
  | 'defaultValue'
  | 'referenceDate'
  | 'granularity'
  | 'hourCycle'
  | 'forceLeadingZeros'
  | 'hideTimeZone'
  | 'minDate'
  | 'maxDate'
  | 'unavailableDates'
  | 'locale'
  | 'calendar'
  | 'timeZone'
  | 'disabled'
  | 'readOnly'
  | 'required'
  | 'name'
  | 'form'
> {}
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, useAttrs, useTemplateRef, watch } from 'vue';
import DateFieldRoot from '../../date-field/root/DateFieldRoot.vue';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { usePickerPopup } from '../../internals/date-time/picker/usePickerPopup';
import { omitUndefinedAttributes } from '../../internals/omitUndefinedAttributes';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useFormReset } from '../../internals/useFormReset';
import { mergeProps } from '../../merge-props';
import { createElementSetter } from '../../utils/popups/createElementSetter';
import { useDatePickerRootContext } from '../root/DatePickerRootContext';
import type {
  DatePickerRootChangeEventDetails,
  DatePickerRootValue,
} from '../root/DatePickerRoot.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DatePickerFieldProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: DatePickerFieldState }): unknown;
  render: ComponentRenderFn<HTMLProps, DatePickerFieldState>;
}>();

const attrs = useAttrs();
const picker = useDatePickerRootContext();
const popup = usePickerPopup();

interface DateFieldActions {
  element: HTMLElement | null;
  inputElement: HTMLInputElement | null;
  clear: () => void;
}

// This part renders `DateField.Root` and makes no element of its own. The template has one form for
// `#render` and one for the content. A `v-if` on a slot template makes the slots of
// `DateField.Root` dynamic. Vue then renders `DateField.Root` again each time this part renders.
const field = useTemplateRef<DateFieldActions>('field');
const element = computed(() => field.value?.element ?? null);
const inputElement = computed(() => field.value?.inputElement ?? null);

const setFieldElement = createElementSetter(picker.fieldElement);
watch(element, setFieldElement, { immediate: true, flush: 'post' });
// Vue stops the `watch` before it unmounts `DateField.Root`, so the `watch` never gets `null`. The
// positioner and the root then use the trigger.
onBeforeUnmount(() => {
  setFieldElement(null);
});

// The field holds the input of the form, so it hears about the reset.
useFormReset(inputElement, (event) => {
  picker.reset(createChangeEventDetails(REASONS.none, event));
});

function handleKeydown(event: KeyboardEvent) {
  if (
    event.altKey &&
    event.key === 'ArrowDown' &&
    !event.defaultPrevented &&
    !picker.disabled.value &&
    !picker.props.readOnly
  ) {
    event.preventDefault();
    popup.openByKey(event);
  }
}

function handleValueChange(
  value: DatePickerRootValue | null,
  details: DatePickerRootChangeEventDetails,
) {
  picker.commit(value, details);
}

const fieldHandlers = { onKeydown: handleKeydown };

function fieldProps() {
  const root = picker.props;
  return {
    ...mergeProps(fieldHandlers, omitUndefinedAttributes(attrs)),
    ...props,
    value: picker.value.value,
    // The default value gives the kind of a new value, the same kind as for the calendar.
    defaultValue: picker.template.value,
    referenceDate: root.referenceDate,
    granularity: root.granularity,
    hourCycle: root.hourCycle,
    forceLeadingZeros: root.forceLeadingZeros,
    hideTimeZone: root.hideTimeZone,
    minDate: root.minDate,
    maxDate: root.maxDate,
    unavailableDates: root.unavailableDates,
    locale: root.locale,
    calendar: root.calendar,
    timeZone: root.timeZone,
    disabled: root.disabled,
    readOnly: root.readOnly,
    required: root.required,
    name: root.name,
    form: root.form,
  };
}

defineExpose({
  element,
  inputElement,
  /** Sets the value to `null` and empties each segment. The reason of the change is `none`. */
  clear: () => field.value?.clear(),
});
</script>

<template>
  <DateFieldRoot
    v-if="$slots.render"
    ref="field"
    v-bind="fieldProps()"
    @value-change="handleValueChange"
  >
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
  </DateFieldRoot>
  <DateFieldRoot v-else ref="field" v-bind="fieldProps()" @value-change="handleValueChange">
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </DateFieldRoot>
</template>
