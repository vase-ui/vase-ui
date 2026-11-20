<script setup lang="ts">
import { computed, mergeProps, provide, useAttrs, watchEffect } from 'vue';
import { useElement } from '../common/element';
import { toPlainTime } from '../common/date-time/temporal';
import { mergeGetters } from '../common/picker/root';
import { warn } from '../common/warn';
import { listKey, useListbox } from './listbox';
import { injectTimePicker } from './root';
import TimePickerItem from './TimePickerItem.vue';
import { DEFAULT_LIST_STEP, isValidListStep, listTimes } from './times';
import type { TimePickerListProps, TimePickerListState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimePickerListProps>(), { step: DEFAULT_LIST_STEP });
defineSlots<{
  /** One time of the list. With no slot, the list renders a `TimePicker.Item` for each time. */
  item?(scope: { time: Temporal.PlainTime; index: number }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: TimePickerListState;
    times: Temporal.PlainTime[];
  }): unknown;
}>();

if (process.env.NODE_ENV !== 'production') {
  watchEffect(() => {
    if (!isValidListStep(props.step)) {
      warn(
        'TimePicker.List `step` must be a whole number of minutes above 0.',
        `The list uses a step of ${DEFAULT_LIST_STEP} minutes instead.`,
        'Set `step` to a whole number above 0.',
      );
    }
  });
}

const picker = injectTimePicker('List');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
// A developer can give a new object for the same limit at each render, so the list reads the text
// of each limit, and its times stay the same objects.
const min = computed(() => picker.props.min?.toString());
const max = computed(() => picker.props.max?.toString());
const times = computed(() =>
  listTimes(isValidListStep(props.step) ? props.step : DEFAULT_LIST_STEP, min.value, max.value),
);
const listbox = useListbox({
  element,
  keys: () => times.value.map((time) => time.toString()),
  selected: () => (picker.value === null ? undefined : toPlainTime(picker.value).toString()),
});
provide(
  listKey,
  mergeGetters(listbox.forItem, {
    get closes() {
      return picker.closeOnSelect;
    },
  }),
);

const state = computed<TimePickerListState>(() => ({
  disabled: picker.disabled,
  readonly: picker.readonly,
}));

function elementProps() {
  return mergeProps(
    {
      role: 'listbox',
      'aria-disabled': state.value.disabled ? 'true' : undefined,
      'aria-readonly': state.value.readonly ? 'true' : undefined,
      onKeydown: listbox.onKeydown,
      onFocusin: listbox.onFocusin,
    },
    attrs,
  );
}

defineExpose({ element });
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
    :times="times"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <template v-for="(time, index) in times" :key="time.toString()">
      <slot v-if="$slots.item" name="item" :time="time" :index="index" />
      <TimePickerItem v-else :time="time" />
    </template>
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <template v-for="(time, index) in times" :key="time.toString()">
      <slot v-if="$slots.item" name="item" :time="time" :index="index" />
      <TimePickerItem v-else :time="time" />
    </template>
  </div>
</template>
