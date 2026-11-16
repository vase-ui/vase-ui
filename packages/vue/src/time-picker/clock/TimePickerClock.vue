<script lang="ts">
import type {
  TimeClockRootProps,
  TimeClockRootState,
} from '../../time-clock/root/TimeClockRoot.vue';

export interface TimePickerClockState extends TimeClockRootState {}

/**
 * The props of `TimeClock.Root` that the picker does not own. The root of the picker owns the
 * value, the granularity, the hour cycle, the limits, the locale and the states `disabled` and
 * `readOnly`.
 */
export interface TimePickerClockProps extends Omit<
  TimeClockRootProps,
  | 'value'
  | 'defaultValue'
  | 'granularity'
  | 'hourCycle'
  | 'minTime'
  | 'maxTime'
  | 'referenceDate'
  | 'locale'
  | 'disabled'
  | 'readOnly'
> {}
</script>

<script setup lang="ts">
import { computed, shallowRef, useAttrs, useTemplateRef } from 'vue';
import { usePickerPopup } from '../../internals/date-time/picker/usePickerPopup';
import { withTime } from '../../internals/date-time/temporal';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import TimeClockRoot from '../../time-clock/root/TimeClockRoot.vue';
import type {
  TimeClockRootChangeEventDetails,
  TimeClockRootCommitEventDetails,
} from '../../time-clock/root/TimeClockRoot.vue';
import { nextView } from '../../time-clock/utils/clockViews';
import type { TimeClockView } from '../../time-clock/utils/clockViews';
import { useTimePickerRootContext } from '../root/TimePickerRootContext';
import { useFocusPartOnOpen } from '../utils/useFocusPartOnOpen';
import type { TimePickerRootValue } from '../root/TimePickerRoot.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimePickerClockProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: TimePickerClockState }): unknown;
  render: ComponentRenderFn<HTMLProps, TimePickerClockState>;
}>();

const attrs = useAttrs();
const picker = useTimePickerRootContext();
const popup = usePickerPopup();

// This part renders `TimeClock.Root` and makes no element of its own. The template has one form for
// `#render` and one for the content. A `v-if` on a slot template makes the slots of
// `TimeClock.Root` dynamic. Vue then renders `TimeClock.Root` again each time this part renders.
const clock = useTemplateRef<{ element: HTMLElement | null }>('clock');
const element = computed(() => clock.value?.element ?? null);

// The popup puts the focus on the first tabbable element, which can be a view or a day period. The
// face of the clock is the element that a person sets the time with.
useFocusPartOnOpen(popup, () =>
  element.value?.querySelector<HTMLInputElement>('input[type="range"]'),
);

// The clock commits a view and shows the next view, so the picker follows the view to know the
// last commit.
const shownView = shallowRef<TimeClockView>(props.defaultView ?? 'hour');
const view = computed(() => props.view ?? shownView.value);
const isLastView = computed(
  () => nextView(view.value, picker.props.granularity ?? 'minute') === undefined,
);

function handleValueChange(value: TimePickerRootValue, details: TimeClockRootChangeEventDetails) {
  picker.commit(value, details);
}

// The last commit sets the whole time, so it closes the popup when a selection does.
function handleValueCommitted(
  _value: TimePickerRootValue,
  details: TimeClockRootCommitEventDetails,
) {
  if (isLastView.value && picker.closeOnSelect.value) {
    popup.closeAfterSelection(details.event);
  }
}

function handleViewChange(next: TimeClockView) {
  shownView.value = next;
}

// `TimeClock.Root` has a type parameter for the kind of its value, and vue-tsc takes it from the
// props. The picker has any kind, so the value and the reference date have the type `any`. The
// reference date gives the kind of a new value, the same kind as for the field, and the time that
// the face shows while the picker has no value.
function clockProps() {
  const root = picker.props;
  const valueProps: Record<string, any> = {
    value: picker.value.value,
    referenceDate: withTime(picker.template.value, picker.referenceTime.value),
  };
  return {
    ...attrs,
    ...props,
    ...valueProps,
    granularity: root.granularity,
    hourCycle: root.hourCycle,
    minTime: root.minTime,
    maxTime: root.maxTime,
    locale: root.locale,
    disabled: picker.disabled.value,
    readOnly: picker.readOnly.value,
  };
}

defineExpose({ element });
</script>

<template>
  <TimeClockRoot
    v-if="$slots.render"
    ref="clock"
    v-bind="clockProps()"
    @value-change="handleValueChange"
    @value-committed="handleValueCommitted"
    @update:view="handleViewChange"
  >
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
  </TimeClockRoot>
  <TimeClockRoot
    v-else
    ref="clock"
    v-bind="clockProps()"
    @value-change="handleValueChange"
    @value-committed="handleValueCommitted"
    @update:view="handleViewChange"
  >
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </TimeClockRoot>
</template>
