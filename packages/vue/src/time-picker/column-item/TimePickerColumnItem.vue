<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TimePickerColumnValue } from '../utils/columns';

export interface TimePickerColumnItemState {
  /**
   * Whether the time of the picker has the value of the item in the column.
   */
  selected: boolean;
  /**
   * Whether the user cannot select the item, or the picker ignores user interaction.
   */
  disabled: boolean;
}

export interface TimePickerColumnItemProps
  extends
    VaseUIComponentProps<TimePickerColumnItemState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * The value that the item selects: a number for an hour, a minute or a second, and `'am'` or
   * `'pm'` for a day period. It is the `value` of the slot `item` of `TimePicker.Column`.
   * An hour of a 12-hour cycle goes from 1 to 12, and 12 is the first hour of the day.
   */
  value: TimePickerColumnValue;
  /**
   * Whether the user cannot select the item.
   * `minTime` and `maxTime` of the picker also disable an item.
   * @default false
   */
  disabled?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { useIsHydrating } from '../../common/hydration';
import { ACTIVE_COMPOSITE_ITEM } from '../../internals/composite/constants';
import { useCompositeItem } from '../../internals/composite/item/useCompositeItem';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { usePickerPopup } from '../../internals/date-time/picker/usePickerPopup';
import { withTime } from '../../internals/date-time/temporal';
import { REASONS } from '../../internals/reasons';
import type { HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { clampTime } from '../../time-clock/utils/clockViews';
import { useTimePickerColumnContext } from '../column/TimePickerColumnContext';
import { useTimePickerRootContext } from '../root/TimePickerRootContext';
import { columnText, isColumnValueAllowed, timeOfColumnValue } from '../utils/columns';
import { useTimePickerFormat } from '../utils/useTimePickerFormat';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimePickerColumnItemProps>(), {
  as: 'div',
  disabled: false,
});

defineSlots<{
  default(props: { state: TimePickerColumnItemState; text: string }): unknown;
  render(props: { props: HTMLProps; state: TimePickerColumnItemState; text: string }): unknown;
}>();

const picker = useTimePickerRootContext();
const column = useTimePickerColumnContext();
const popup = usePickerPopup();
const { locale, hourCycle } = useTimePickerFormat(picker);
const isHydrating = useIsHydrating();

const limits = computed(() => ({
  minTime: picker.props.minTime,
  maxTime: picker.props.maxTime,
  disabledTimes: undefined,
}));

const selected = computed(() => column.selectedValue.value === props.value);
const disabled = computed(
  () =>
    props.disabled ||
    picker.disabled.value ||
    !isColumnValueAllowed(
      column.unit.value,
      hourCycle.value,
      picker.time.value,
      props.value,
      limits.value,
    ),
);

const state = computed<TimePickerColumnItemState>(() => ({
  selected: selected.value,
  disabled: disabled.value,
}));

const text = computed(() =>
  columnText(column.unit.value, hourCycle.value, props.value, locale.value),
);

const { compositeProps, compositeRef } = useCompositeItem({ active: selected, disabled });

// A press on the selected item changes no value. It closes the popup only when the column does.
function select(event: MouseEvent | KeyboardEvent) {
  if (disabled.value || picker.readOnly.value) {
    return;
  }
  if (!selected.value) {
    const time = clampTime(
      timeOfColumnValue(column.unit.value, hourCycle.value, picker.time.value, props.value),
      limits.value,
    );
    const details = createChangeEventDetails(REASONS.itemPress, event);
    picker.commit(withTime(picker.template.value, time), details);
    if (details.isCanceled) {
      return;
    }
  }
  if (column.closeOnSelect.value) {
    popup.closeAfterSelection(event);
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    select(event);
  }
}

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: [compositeRef],
  props: (attrs) => [
    compositeProps.value,
    {
      role: 'option',
      'aria-selected': selected.value,
      'aria-disabled': disabled.value || undefined,
      [ACTIVE_COMPOSITE_ITEM]: selected.value ? '' : undefined,
      // The text comes from the data of `Intl` in the engine, and a server and a browser can differ.
      'data-allow-mismatch': isHydrating.value ? 'attribute,text' : undefined,
      onClick: select,
      onKeydown,
    },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" :text="text" />
  <component :is="as" v-else-if="$slots.default || as !== 'div'" v-bind="elementProps()"
    ><slot :state="state" :text="text">{{ text }}</slot></component
  >
  <div v-else v-bind="elementProps()">{{ text }}</div>
</template>
