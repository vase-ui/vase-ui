<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface TimePickerItemState {
  /**
   * Whether the time of the picker is the time of the item.
   */
  selected: boolean;
  /**
   * Whether the user cannot select the item, or the picker ignores user interaction.
   */
  disabled: boolean;
}

export interface TimePickerItemProps
  extends
    VaseUIComponentProps<TimePickerItemState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * The time that the item selects.
   * It is the `time` of the slot `item` of `TimePicker.List`.
   * The text of the item is this time in the locale of the picker.
   */
  time: Temporal.PlainTime;
  /**
   * Whether the user cannot select the item.
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
import { formatText } from '../../internals/date-time/calendar/formatText';
import { usePickerPopup } from '../../internals/date-time/picker/usePickerPopup';
import { toPlainTime, withTime } from '../../internals/date-time/temporal';
import { REASONS } from '../../internals/reasons';
import type { HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useFormatLocale } from '../../utils/useFormatLocale';
import { useTimePickerRootContext } from '../root/TimePickerRootContext';
import { hourCycleOption } from '../utils/useTimePickerFormat';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimePickerItemProps>(), { as: 'div', disabled: false });

defineSlots<{
  default(props: { state: TimePickerItemState; text: string }): unknown;
  render(props: { props: HTMLProps; state: TimePickerItemState; text: string }): unknown;
}>();

const picker = useTimePickerRootContext();
const popup = usePickerPopup();
const locale = useFormatLocale(() => picker.props.locale);
const isHydrating = useIsHydrating();

const selected = computed(
  () =>
    picker.value.value !== null &&
    Temporal.PlainTime.compare(toPlainTime(picker.value.value), props.time) === 0,
);
const disabled = computed(() => props.disabled || picker.disabled.value);

const state = computed<TimePickerItemState>(() => ({
  selected: selected.value,
  disabled: disabled.value,
}));

const text = computed(() =>
  formatText(
    props.time,
    { hour: 'numeric', minute: '2-digit', hourCycle: hourCycleOption(picker.props.hourCycle) },
    locale.value,
  ),
);

const { compositeProps, compositeRef } = useCompositeItem({ active: selected, disabled });

// A press on the selected item changes no value, and it still closes the popup.
function select(event: MouseEvent | KeyboardEvent) {
  if (disabled.value || picker.readOnly.value) {
    return;
  }
  if (!selected.value) {
    const details = createChangeEventDetails(REASONS.itemPress, event);
    picker.commit(withTime(picker.template.value, props.time), details);
    if (details.isCanceled) {
      return;
    }
  }
  if (picker.closeOnSelect.value) {
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
