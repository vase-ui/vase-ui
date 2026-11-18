<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface TimePickerListState {
  /**
   * Whether the picker ignores user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user can see the time but not change it.
   */
  readOnly: boolean;
}

export interface TimePickerListProps
  extends
    VaseUIComponentProps<TimePickerListState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * The distance between two times of the list, in minutes. It must be a whole number above 0.
   * The list starts at `minTime` of the picker, or at midnight, and ends at `maxTime`, or at the
   * last time of the day.
   * @default 30
   */
  step?: number | undefined;
}
</script>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { warn } from '../../common/warn';
import { useCompositeRoot } from '../../internals/composite/root/useCompositeRoot';
import { usePickerFocusTarget } from '../../internals/date-time/picker/usePickerPopup';
import { toPlainTime } from '../../internals/date-time/temporal';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import TimePickerItem from '../item/TimePickerItem.vue';
import { useTimePickerRootContext } from '../root/TimePickerRootContext';
import { findOptionToFocus } from '../utils/findOptionToFocus';
import { DEFAULT_LIST_STEP, isValidListStep, listTimes } from '../utils/timeList';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimePickerListProps>(), {
  as: 'div',
  step: DEFAULT_LIST_STEP,
});

defineSlots<{
  /**
   * Renders one time of the list. With no slot, the list renders a `TimePicker.Item` for each time.
   */
  item(props: { time: Temporal.PlainTime; index: number }): unknown;
  render: ComponentRenderFn<HTMLProps, TimePickerListState>;
}>();

const picker = useTimePickerRootContext();

if (process.env.NODE_ENV !== 'production') {
  watch(
    () => props.step,
    (step) => {
      if (!isValidListStep(step)) {
        warn(
          'TimePicker.List `step` must be a whole number of minutes above 0.',
          `The list uses a step of ${DEFAULT_LIST_STEP} minutes instead.`,
          'Set `step` to a whole number above 0.',
        );
      }
    },
    { immediate: true },
  );
}

// A consumer can make a new `Temporal` object for the same time in each render, so the list reads
// the text of each limit. The times of the list then stay the same objects until a limit changes.
const minTime = computed(() => picker.props.minTime?.toString());
const maxTime = computed(() => picker.props.maxTime?.toString());
const times = computed(() =>
  listTimes(
    isValidListStep(props.step) ? props.step : DEFAULT_LIST_STEP,
    minTime.value,
    maxTime.value,
  ),
);

// With a selected time, the tab stop is the item of that time, so the focus enters the list there.
const hasSelectedItem = computed(() => {
  const { value } = picker.value;
  const selected = value === null ? null : toPlainTime(value);
  return (
    selected !== null &&
    times.value.some((time) => Temporal.PlainTime.compare(time, selected) === 0)
  );
});

const {
  props: compositeProps,
  rootRef,
  itemMap,
} = useCompositeRoot({
  orientation: 'vertical',
  enableHomeAndEndKeys: true,
  hasActiveItem: hasSelectedItem,
});

const state = computed<TimePickerListState>(() => ({
  disabled: picker.disabled.value,
  readOnly: picker.readOnly.value,
}));

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  ref: [rootRef],
  props: (attrs) => [
    compositeProps,
    {
      role: 'listbox',
      'aria-label': 'Time',
      'aria-disabled': state.value.disabled || undefined,
      'aria-readonly': state.value.readOnly || undefined,
    },
    attrs,
  ],
});

usePickerFocusTarget(() => findOptionToFocus(itemMap.value));

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <template v-for="(time, index) in times" :key="time.toString()">
      <slot v-if="$slots.item" name="item" :time="time" :index="index" />
      <TimePickerItem v-else :time="time" />
    </template>
  </component>
</template>
