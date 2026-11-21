<script setup lang="ts">
import { mergeProps, provide, useAttrs, watch } from 'vue';
import { withTime } from '../common/date-time/temporal';
import { useModel } from '../common/model';
import { pickerControlKey } from '../common/picker/control';
import { addPopupFocusTarget, usePickerPart, usePickerPopup } from '../common/picker/popup';
import TimeClockRoot from '../time-clock/TimeClockRoot.vue';
import type { TimeClockRootChangeEventDetails } from '../time-clock/types';
import { nextView, type TimeClockView } from '../time-clock/views';
import { injectTimePicker } from './root';
import type {
  TimePickerClockEmits,
  TimePickerClockProps,
  TimePickerClockState,
  TimePickerRootValue,
} from './types';
import type { ElementSlotProps } from '../common/element';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimePickerClockProps>(), {
  view: undefined,
  defaultView: 'hour',
});
const emit = defineEmits<TimePickerClockEmits>();
defineSlots<{
  default?(scope: { state: TimePickerClockState }): unknown;
  element?(scope: ElementSlotProps<TimePickerClockState>): unknown;
}>();

const picker = injectTimePicker('Clock');
const popup = usePickerPopup('Clock');
const attrs = useAttrs();
const part = usePickerPart();
const shownView = useModel(() => props.view, props.defaultView);

// An uncontrolled clock starts at its first view at each open, also in a popup that stays mounted.
watch(
  () => popup.open,
  (open) => {
    if (open) shownView.setOwn(props.defaultView);
  },
);

provide(pickerControlKey, {
  addFocusTarget: addPopupFocusTarget,
  onPick() {},
  onCancel() {},
});

function clockProps() {
  const root = picker.props;
  return mergeProps(attrs, {
    modelValue: picker.value,
    defaultValue: undefined,
    referenceDate: withTime(picker.template, picker.time),
    view: shownView.value.value,
    granularity: root.granularity,
    hourCycle: root.hourCycle,
    min: root.min,
    max: root.max,
    locale: root.locale,
    disabled: picker.disabled,
    readonly: root.readonly,
    onValueChange: (value: TimePickerRootValue, details: TimeClockRootChangeEventDetails) =>
      picker.commit(value, details),
    // The view of the commit is the view before the commit shows the next one.
    onValueCommitted: (_: TimePickerRootValue, details: { event: Event }) => {
      if (!nextView(shownView.value.value, root.granularity ?? 'minute') && picker.closeOnSelect) {
        popup.closeAfterPick(details.event);
      }
    },
    'onUpdate:view': (next: TimeClockView) => {
      shownView.setOwn(next);
      emit('update:view', next);
    },
  });
}

defineExpose({ element: part.element });
</script>

<template>
  <TimeClockRoot v-if="$slots.element" :ref="part.setPart" v-bind="clockProps()">
    <template #element="scope">
      <slot name="element" v-bind="scope" />
    </template>
  </TimeClockRoot>
  <TimeClockRoot v-else :ref="part.setPart" v-bind="clockProps()">
    <template #default="{ state }">
      <slot :state="state" />
    </template>
  </TimeClockRoot>
</template>
