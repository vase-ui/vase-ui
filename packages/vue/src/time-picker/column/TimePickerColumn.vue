<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TimePickerColumnUnit, TimePickerColumnValue } from '../utils/columns';

export type { TimePickerColumnUnit, TimePickerColumnValue } from '../utils/columns';

export interface TimePickerColumnState {
  /**
   * The unit that the column sets.
   */
  unit: TimePickerColumnUnit;
  /**
   * Whether the picker ignores user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user can see the time but not change it.
   */
  readOnly: boolean;
}

export interface TimePickerColumnProps
  extends
    VaseUIComponentProps<TimePickerColumnState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * The unit that the column sets.
   * A column of day periods renders nothing in a 24-hour cycle.
   */
  unit: TimePickerColumnUnit;
  /**
   * The distance between two values of a column of hours, minutes or seconds.
   * It must be a whole number above 0.
   * @default 1
   */
  step?: number | undefined;
}
</script>

<script setup lang="ts">
import { computed, provide, watch } from 'vue';
import { warn } from '../../common/warn';
import { useCompositeRoot } from '../../internals/composite/root/useCompositeRoot';
import { usePickerFocusTarget } from '../../internals/date-time/picker/usePickerPopup';
import { toPlainTime } from '../../internals/date-time/temporal';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { isValidStep } from '../../time-clock/views';
import TimePickerColumnItem from '../column-item/TimePickerColumnItem.vue';
import { useTimePickerRootContext } from '../root/TimePickerRootContext';
import { columnValues, selectedColumnValue } from '../utils/columns';
import { findOptionToFocus } from '../utils/findOptionToFocus';
import { useTimePickerFormat } from '../utils/useTimePickerFormat';
import { TimePickerColumnContext } from './TimePickerColumnContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimePickerColumnProps>(), { as: 'div', step: 1 });

defineSlots<{
  /**
   * Renders one value of the column. With no slot, the column renders a `TimePicker.ColumnItem`
   * for each value.
   */
  item(props: { value: TimePickerColumnValue; index: number }): unknown;
  render: ComponentRenderFn<HTMLProps, TimePickerColumnState>;
}>();

const picker = useTimePickerRootContext();
const { locale, hourCycle } = useTimePickerFormat(picker);

if (process.env.NODE_ENV !== 'production') {
  watch(
    () => props.step,
    (step) => {
      if (!isValidStep(step)) {
        warn(
          'TimePicker.Column `step` must be a whole number above 0.',
          'The column uses a step of 1 instead.',
          'Set `step` to a whole number above 0.',
        );
      }
    },
    { immediate: true },
  );
}

const values = computed(() =>
  columnValues(props.unit, hourCycle.value, isValidStep(props.step) ? props.step : 1),
);

const selectedValue = computed(() => {
  const { value } = picker.value;
  return value === null
    ? null
    : selectedColumnValue(props.unit, hourCycle.value, toPlainTime(value));
});

// The user sets more than one unit, so a selection in a column keeps the popup open by default.
const closeOnSelect = computed(() => picker.props.closeOnSelect ?? false);

// A 24-hour cycle has no day period.
const isRendered = computed(() => props.unit !== 'dayPeriod' || hourCycle.value === 12);

const { onFocusin, onFocusout, onKeydown, registerRoot, itemMap } = useCompositeRoot({
  orientation: 'vertical',
  enableHomeAndEndKeys: true,
  hasActiveItem: () => selectedValue.value !== null && values.value.includes(selectedValue.value),
});

const state = computed<TimePickerColumnState>(() => ({
  unit: props.unit,
  disabled: picker.disabled.value,
  readOnly: picker.readOnly.value,
}));

const label = computed(() =>
  new Intl.DisplayNames(locale.value, { type: 'dateTimeField' }).of(props.unit),
);

provide(TimePickerColumnContext, {
  unit: computed(() => props.unit),
  selectedValue,
  closeOnSelect,
});

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  ref: registerRoot,
  props: (attrs) => [
    { onFocusin, onFocusout, onKeydown },
    {
      role: 'listbox',
      // A server and a browser can have another `Intl` text, and Vue writes no attribute of a
      // `v-bind` object while it hydrates.
      'aria-label': label.value,
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
  <slot
    v-if="isRendered && usesRenderSlot()"
    name="render"
    :props="elementProps()"
    :state="state"
  />
  <component :is="as" v-else-if="isRendered" v-bind="elementProps()" :ref="setRef">
    <template v-for="(value, index) in values" :key="value">
      <slot v-if="$slots.item" name="item" :value="value" :index="index" />
      <TimePickerColumnItem v-else :value="value" />
    </template>
  </component>
</template>
