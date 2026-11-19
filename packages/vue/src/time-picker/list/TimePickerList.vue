<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

const DEFAULT_LIST_STEP = 30;

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
import { computed, watchEffect } from 'vue';
import { warn } from '../../common/warn';
import { useCompositeRoot } from '../../internals/composite/root/useCompositeRoot';
import { usePickerFocusTarget } from '../../internals/date-time/picker/usePickerPopup';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useTimePickerRootContext, findOptionToFocus } from '../root/TimePickerRootContext';
import { isValidStep } from '../../time-clock/utils/clockViews';
import TimePickerItem from '../item/TimePickerItem.vue';

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
  watchEffect(() => {
    if (!isValidStep(props.step)) {
      warn(
        'TimePicker.List `step` must be a whole number of minutes above 0.',
        `The list uses a step of ${DEFAULT_LIST_STEP} minutes instead.`,
        'Set `step` to a whole number above 0.',
      );
    }
  });
}

// A consumer can make a new `Temporal` object for the same time in each render, so the list reads
// the text of each limit. The times of the list then stay the same objects until a limit changes.
const minTime = computed(() => picker.props.minTime?.toString());
const maxTime = computed(() => picker.props.maxTime?.toString());
const times = computed(() => {
  const step = isValidStep(props.step) ? props.step : DEFAULT_LIST_STEP;
  const last = maxTime.value === undefined ? undefined : Temporal.PlainTime.from(maxTime.value);
  let time =
    minTime.value === undefined ? new Temporal.PlainTime() : Temporal.PlainTime.from(minTime.value);
  const options: Temporal.PlainTime[] = [];
  while (!last || Temporal.PlainTime.compare(time, last) <= 0) {
    options.push(time);
    const next = time.add({ minutes: step });
    // A step past midnight wraps to an earlier time.
    if (Temporal.PlainTime.compare(next, time) <= 0) {
      break;
    }
    time = next;
  }
  return options;
});

const hasSelectedItem = computed(
  () => picker.value.value !== null && times.value.some((time) => time.equals(picker.time.value)),
);

const { onFocusin, onFocusout, onKeydown, registerRoot, itemMap } = useCompositeRoot({
  orientation: 'vertical',
  enableHomeAndEndKeys: true,
  hasActiveItem: hasSelectedItem,
});

const state = computed<TimePickerListState>(() => ({
  disabled: picker.disabled.value,
  readOnly: picker.props.readOnly ?? false,
}));

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  ref: registerRoot,
  props: (attrs) => [
    { onFocusin, onFocusout, onKeydown },
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
