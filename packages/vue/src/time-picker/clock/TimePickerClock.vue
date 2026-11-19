<script lang="ts">
import type {
  TimeClockRootProps,
  TimeClockRootState,
} from '../../time-clock/root/TimeClockRoot.vue';
import type { TimeClockView } from '../../time-clock/utils/clockViews';

export interface TimePickerClockState extends TimeClockRootState {}

/**
 * The props of `TimeClock.Root` that the picker does not own. The root of the picker owns the
 * value, the granularity, the hour cycle, the limits, the locale and the states `disabled` and
 * `readOnly`.
 */
export interface TimePickerClockProps extends Omit<
  TimeClockRootProps,
  | 'modelValue'
  | 'defaultValue'
  | 'defaultView'
  | 'granularity'
  | 'hourCycle'
  | 'minTime'
  | 'maxTime'
  | 'referenceDate'
  | 'locale'
  | 'disabled'
  | 'readOnly'
> {
  /**
   * The unit that an uncontrolled clock shows each time that the popup opens.
   *
   * To render a controlled view, use the `view` prop instead.
   * @default 'hour'
   */
  defaultView?: TimeClockView | undefined;
}
</script>

<script setup lang="ts">
import { computed, useTemplateRef, watch } from 'vue';
import {
  PickerClockOwner,
  providePickerControl,
} from '../../internals/date-time/picker/PickerControlContext';
import { usePickerPopup } from '../../internals/date-time/picker/usePickerPopup';
import { withTime } from '../../internals/date-time/temporal';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { withoutPropsOf } from '../../internals/withoutPropsOf';
import TimeClockRoot from '../../time-clock/root/TimeClockRoot.vue';
import type {
  TimeClockRootCommitEventDetails,
  TimeClockRootViewChangeEventDetails,
} from '../../time-clock/root/TimeClockRoot.vue';
import { nextView } from '../../time-clock/utils/clockViews';
import { useControlled } from '../../common/useControlled';
import { useTimePickerRootContext } from '../root/TimePickerRootContext';
import type { TimePickerRootValue } from '../root/TimePickerRoot.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimePickerClockProps>(), { as: 'div' });

const emit = defineEmits<{
  /**
   * Callback fired when the user commits the time: when a press or a drag that selects a number
   * ends, and when the user presses Enter or Space on the face. A commit also shows the next view.
   * **Warning**: This is a generic event, not a change event.
   *
   * The `eventDetails.reason` indicates what triggered the commit:
   *
   * - `'drag'` when a press or a drag ends
   * - `'keyboard'` when the user presses Enter or Space on the face
   */
  valueCommitted: [value: TimePickerRootValue, eventDetails: TimeClockRootCommitEventDetails];
  /**
   * Callback fired when the view changes.
   *
   * The `eventDetails.reason` indicates what triggered the change:
   *
   * - `'trigger-press'` when the user presses a view trigger
   * - `'drag'` and `'keyboard'` when a commit shows the next view
   *
   * To stop the change, call `eventDetails.cancel()` before the listener returns.
   */
  viewChange: [view: TimeClockView, eventDetails: TimeClockRootViewChangeEventDetails];
  /**
   * Event handler called after `viewChange` with the new view, unless a listener cancels the
   * change. `v-model:view` uses it.
   */
  'update:view': [view: TimeClockView];
}>();

defineSlots<{
  default(props: { state: TimePickerClockState }): unknown;
  render: ComponentRenderFn<HTMLProps, TimePickerClockState>;
}>();

const picker = useTimePickerRootContext();
const popup = usePickerPopup();

const clock = useTemplateRef<{ element: HTMLElement | null }>('clock');
const element = computed(() => clock.value?.element ?? null);

providePickerControl(PickerClockOwner);

const initialView = props.defaultView ?? 'hour';
const currentView = useControlled<TimeClockView>({
  controlled: () => props.view,
  default: () => initialView,
  name: 'TimePicker.Clock',
  state: 'view',
});
// A kept popup starts at the default view on each open.
watch(popup.open, (open) => {
  if (open) {
    currentView.value = props.defaultView ?? 'hour';
  }
});
const isLastView = computed(
  () => nextView(currentView.value, picker.props.granularity ?? 'minute') === undefined,
);

function handleValueCommitted(
  value: TimePickerRootValue,
  details: TimeClockRootCommitEventDetails,
) {
  emit('valueCommitted', value, details);
  if (isLastView.value && picker.closeOnSelect.value) {
    popup.closeAfterSelection(details.event);
  }
}

function handleViewUpdate(next: TimeClockView) {
  currentView.value = next;
  emit('update:view', next);
}

const clockProps = computed(() => ({
  ...props,
  modelValue: picker.value.value,
  referenceDate: withTime(picker.template.value, picker.referenceTime.value),
  view: currentView.value,
  granularity: picker.props.granularity,
  hourCycle: picker.props.hourCycle,
  minTime: picker.props.minTime,
  maxTime: picker.props.maxTime,
  locale: picker.props.locale,
  disabled: picker.disabled.value,
  readOnly: picker.props.readOnly,
}));

defineExpose({ element });
</script>

<template>
  <TimeClockRoot
    v-if="$slots.render"
    ref="clock"
    v-bind="{ ...withoutPropsOf($attrs, TimeClockRoot), ...clockProps }"
    @value-change="picker.commit"
    @value-committed="handleValueCommitted"
    @view-change="(next, details) => emit('viewChange', next, details)"
    @update:view="handleViewUpdate"
  >
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
  </TimeClockRoot>
  <TimeClockRoot
    v-else
    ref="clock"
    v-bind="{ ...withoutPropsOf($attrs, TimeClockRoot), ...clockProps }"
    @value-change="picker.commit"
    @value-committed="handleValueCommitted"
    @view-change="(next, details) => emit('viewChange', next, details)"
    @update:view="handleViewUpdate"
  >
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </TimeClockRoot>
</template>
