<script lang="ts">
import type { VaseUIComponentProps } from '../../internals/types';
import type { TimeClockRootProps, TimeClockRootState, TimeClockView } from '../../time-clock/types';

export interface TimePickerClockState extends TimeClockRootState {}

/**
 * The props of `TimeClock.Root` that the picker does not own. The root of the picker owns the
 * value, the granularity, the hour cycle, the limits, the locale and the states `disabled` and
 * `readOnly`.
 */
export interface TimePickerClockProps
  extends
    VaseUIComponentProps<TimePickerClockState>,
    Omit<
      TimeClockRootProps,
      | 'as'
      | 'modelValue'
      | 'defaultValue'
      | 'defaultView'
      | 'granularity'
      | 'hourCycle'
      | 'min'
      | 'max'
      | 'referenceDate'
      | 'locale'
      | 'disabled'
      | 'readonly'
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
import TimeClockRoot from '../../time-clock/TimeClockRoot.vue';
import type {
  TimeClockRootChangeEventDetails,
  TimeClockRootCommitEventDetails,
  TimeClockRootViewChangeEventDetails,
} from '../../time-clock/types';
import { nextView } from '../../time-clock/views';
import { useControlled } from '../../common/useControlled';
import { useTimePickerRootContext } from '../root/TimePickerRootContext';
import type { TimePickerRootValue } from '../root/TimePickerRoot.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimePickerClockProps>(), { as: 'div' });

// The events of `TimeClock.Root` that are not about the value. The root of the picker gives the
// events of the value.
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

// This part renders `TimeClock.Root` and makes no element of its own. The template has one form for
// the `element` slot of the root and one for the content. A `v-if` on a slot template makes the
// slots of `TimeClock.Root` dynamic. Vue then renders `TimeClock.Root` again at each render.
const clock = useTemplateRef<{ element: HTMLElement | null }>('clock');
const element = computed(() => clock.value?.element ?? null);

providePickerControl(PickerClockOwner);

// The clock commits a view and shows the next view, so the picker follows the view to know the
// last commit.
const initialView = props.defaultView ?? 'hour';
const currentView = useControlled<TimeClockView>({
  controlled: () => props.view,
  default: () => initialView,
  name: 'TimePicker.Clock',
  state: 'view',
});
// A clock in a popup that mounts at each open starts at its first view. The part thus gives the
// view to `TimeClock.Root`, and it shows the first view again each time that a popup that stays
// mounted opens.
watch(popup.open, (open) => {
  if (open) {
    currentView.value = props.defaultView ?? 'hour';
  }
});
const isLastView = computed(
  () => nextView(currentView.value, picker.props.granularity ?? 'minute') === undefined,
);

function handleValueChange(value: TimePickerRootValue, details: TimeClockRootChangeEventDetails) {
  picker.commit(value, details);
}

// The last commit sets the whole time, so it closes the popup when a selection does.
function handleValueCommitted(
  value: TimePickerRootValue,
  details: TimeClockRootCommitEventDetails,
) {
  emit('valueCommitted', value, details);
  if (isLastView.value && picker.closeOnSelect.value) {
    popup.closeAfterSelection(details.event);
  }
}

// `TimeClock.Root` reads `details.isCanceled` after this emit returns, so a listener can stop the
// change of the view.
function handleViewChange(next: TimeClockView, details: TimeClockRootViewChangeEventDetails) {
  emit('viewChange', next, details);
}

function handleViewUpdate(next: TimeClockView) {
  currentView.value = next;
  emit('update:view', next);
}

// `TimeClock.Root` has a type parameter for the kind of its value, and vue-tsc takes it from the
// props. The picker has any kind, so the value and the reference date have the type `any`. The
// reference date gives the kind of a new value, the same kind as for the field, and the time that
// the face shows while the picker has no value.
function clockProps() {
  const root = picker.props;
  const valueProps: Record<string, any> = {
    modelValue: picker.value.value,
    referenceDate: withTime(picker.template.value, picker.referenceTime.value),
  };
  // `as` is the element of this part.
  const { as: _as, ...clockOwnProps } = props;
  return {
    ...clockOwnProps,
    ...valueProps,
    view: currentView.value,
    granularity: root.granularity,
    hourCycle: root.hourCycle,
    min: root.minTime,
    max: root.maxTime,
    locale: root.locale,
    disabled: picker.disabled.value,
    readonly: picker.readOnly.value,
  };
}

defineExpose({ element });
</script>

<template>
  <TimeClockRoot
    v-if="$slots.render"
    ref="clock"
    v-bind="{ ...withoutPropsOf($attrs, TimeClockRoot), ...clockProps() }"
    @value-change="handleValueChange"
    @value-committed="handleValueCommitted"
    @view-change="handleViewChange"
    @update:view="handleViewUpdate"
  >
    <template #element="{ props: rootProps, elementRef, state }">
      <slot name="render" :props="{ ...rootProps, ref: elementRef }" :state="state" />
    </template>
  </TimeClockRoot>
  <TimeClockRoot
    v-else-if="as !== 'div'"
    ref="clock"
    v-bind="{ ...withoutPropsOf($attrs, TimeClockRoot), ...clockProps() }"
    @value-change="handleValueChange"
    @value-committed="handleValueCommitted"
    @view-change="handleViewChange"
    @update:view="handleViewUpdate"
  >
    <template #element="{ props: rootProps, elementRef, state }">
      <component :is="as" v-bind="rootProps" :ref="elementRef">
        <slot :state="state" />
      </component>
    </template>
  </TimeClockRoot>
  <TimeClockRoot
    v-else
    ref="clock"
    v-bind="{ ...withoutPropsOf($attrs, TimeClockRoot), ...clockProps() }"
    @value-change="handleValueChange"
    @value-committed="handleValueCommitted"
    @view-change="handleViewChange"
    @update:view="handleViewUpdate"
  >
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </TimeClockRoot>
</template>
