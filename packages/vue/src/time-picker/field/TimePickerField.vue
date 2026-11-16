<script lang="ts">
import type {
  TimeFieldRootProps,
  TimeFieldRootState,
} from '../../time-field/root/TimeFieldRoot.vue';

export interface TimePickerFieldState extends TimeFieldRootState {}

/**
 * The props of `TimeField.Root` that the picker does not own. The root of the picker owns the
 * value, the granularity, the hour cycle, the limits, the locale and the props of the form.
 */
export interface TimePickerFieldProps extends Omit<
  TimeFieldRootProps,
  | 'value'
  | 'defaultValue'
  | 'referenceDate'
  | 'granularity'
  | 'hourCycle'
  | 'forceLeadingZeros'
  | 'hideTimeZone'
  | 'minTime'
  | 'maxTime'
  | 'locale'
  | 'disabled'
  | 'readOnly'
  | 'required'
  | 'name'
  | 'form'
> {}
</script>

<script setup lang="ts">
import { computed, useAttrs, useTemplateRef, watch } from 'vue';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { usePickerPopup } from '../../internals/date-time/picker/usePickerPopup';
import { omitUndefinedAttributes } from '../../internals/omitUndefinedAttributes';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useFormReset } from '../../internals/useFormReset';
import { mergeProps } from '../../merge-props';
import TimeFieldRoot from '../../time-field/root/TimeFieldRoot.vue';
import { createElementSetter } from '../../utils/popups/createElementSetter';
import { useTimePickerRootContext } from '../root/TimePickerRootContext';
import type {
  TimePickerRootChangeEventDetails,
  TimePickerRootValue,
} from '../root/TimePickerRoot.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimePickerFieldProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: TimePickerFieldState }): unknown;
  render: ComponentRenderFn<HTMLProps, TimePickerFieldState>;
}>();

const attrs = useAttrs();
const picker = useTimePickerRootContext();
const popup = usePickerPopup();

interface TimeFieldActions {
  element: HTMLElement | null;
  inputElement: HTMLInputElement | null;
  clear: () => void;
}

// This part renders `TimeField.Root` and makes no element of its own. The template has one form for
// `#render` and one for the content. A `v-if` on a slot template makes the slots of
// `TimeField.Root` dynamic. Vue then renders `TimeField.Root` again each time this part renders.
const field = useTemplateRef<TimeFieldActions>('field');
const element = computed(() => field.value?.element ?? null);
const inputElement = computed(() => field.value?.inputElement ?? null);

const setFieldElement = createElementSetter(picker.fieldElement);
watch(element, setFieldElement, { immediate: true, flush: 'post' });

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
    !picker.readOnly.value
  ) {
    event.preventDefault();
    popup.openByKey(event);
  }
}

function handleValueChange(
  value: TimePickerRootValue | null,
  details: TimePickerRootChangeEventDetails,
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
    // The default value gives the kind of a new value, the same kind as for each other part.
    defaultValue: picker.template.value,
    referenceDate: root.referenceDate,
    granularity: root.granularity,
    hourCycle: root.hourCycle,
    forceLeadingZeros: root.forceLeadingZeros,
    hideTimeZone: root.hideTimeZone,
    minTime: root.minTime,
    maxTime: root.maxTime,
    locale: root.locale,
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
  <TimeFieldRoot
    v-if="$slots.render"
    ref="field"
    v-bind="fieldProps()"
    @value-change="handleValueChange"
  >
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
  </TimeFieldRoot>
  <TimeFieldRoot v-else ref="field" v-bind="fieldProps()" @value-change="handleValueChange">
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </TimeFieldRoot>
</template>
