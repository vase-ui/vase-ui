<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type { DayState } from '../../internals/date-time/calendar/dayState';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';

export interface CalendarDayButtonState extends DayState {}

export interface CalendarDayButtonProps
  extends
    NativeButtonProps,
    VaseUIComponentProps<CalendarDayButtonState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<ButtonHTMLAttributes>, 'disabled'> {
  /**
   * The format of the date that names the button. The default is the weekday, the day, the month
   * and the year in full.
   */
  format?: Intl.DateTimeFormatOptions | undefined;
}
</script>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useIsHydrating } from '../../common/hydration';
import { formatText } from '../../internals/date-time/calendar/formatText';
import { isSameDay } from '../../internals/date-time/temporal';
import type { HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { useRenderElement } from '../../internals/useRenderElement';
import { useCalendarDayContext } from '../day/CalendarDayContext';
import { dayStateAttributesMapping } from '../day/stateAttributesMapping';
import { useCalendarRootContext } from '../root/CalendarRootContext';

defineOptions({ inheritAttrs: false });

const FULL_DATE: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
};

const props = withDefaults(defineProps<CalendarDayButtonProps>(), {
  as: 'button',
  nativeButton: true,
});

defineSlots<{
  default(props: { state: CalendarDayButtonState; text: string }): unknown;
  render(props: { props: HTMLProps; state: CalendarDayButtonState; text: string }): unknown;
}>();

const root = useCalendarRootContext();
const { day, state } = useCalendarDayContext();
const isHydrating = useIsHydrating();

const isTabStop = computed(
  () => root.tabStop.value !== null && isSameDay(root.tabStop.value, day.value),
);
const text = computed(() => formatText(day.value, { day: 'numeric' }, root.locale.value));
const label = computed(() => formatText(day.value, props.format ?? FULL_DATE, root.locale.value));

const { getButtonProps, buttonRef } = useButton({
  disabled: () => state.value.disabled,
  native: () => props.nativeButton,
});

const { element, elementProps } = useRenderElement('button', props, {
  state,
  ref: buttonRef,
  props: (attrs) => {
    const tabindex = isTabStop.value ? 0 : -1;
    return [
      {
        'aria-label': label.value,
        'aria-current': state.value.today ? 'date' : undefined,
        // The button of a disabled day gets `disabled` or `aria-disabled` from `useButton`. A key
        // with the value `undefined` here would replace that attribute.
        ...(state.value.unavailable && { 'aria-disabled': true }),
        // The tab stop of a server can be another day than the tab stop of the browser, because the
        // clock of a server can differ. The day text also comes from the data of `Intl` in the
        // engine. Hydration does not patch an attribute, so the string differs from the number that
        // the button gives after the mount, and Vue then writes the attribute again.
        tabindex: isHydrating.value ? String(tabindex) : tabindex,
        'data-allow-mismatch': isHydrating.value ? 'attribute,text' : undefined,
        onClick: (event: MouseEvent) => {
          root.pressDay(day.value, event);
        },
        onFocusin: (event: FocusEvent) => {
          root.onDayFocus(day.value, event);
        },
        onKeydown: (event: KeyboardEvent) => {
          root.onDayKeydown(day.value, event);
        },
      },
      attrs,
      getButtonProps,
    ];
  },
  stateAttributesMapping: dayStateAttributesMapping,
});

// The root focuses a day after a key moves the focus, and it finds the button of the day here.
watch(
  [element, day],
  ([button, date], _previous, onCleanup) => {
    if (button) {
      onCleanup(root.registerDay(date, button));
    }
  },
  { flush: 'post' },
);

defineExpose({ element });
</script>

<template>
  <template v-if="!state.hidden">
    <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" :text="text" />
    <component :is="as" v-else v-bind="elementProps()"
      ><slot :state="state" :text="text">{{ text }}</slot></component
    >
  </template>
</template>
