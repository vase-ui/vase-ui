<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';
import type { RangeCalendarDayState } from '../day/RangeCalendarDay.vue';

export interface RangeCalendarDayButtonState extends RangeCalendarDayState {}

export interface RangeCalendarDayButtonProps
  extends
    NativeButtonProps,
    VaseUIComponentProps<RangeCalendarDayButtonState>,
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
import { useCalendarMonthContext } from '../../calendar/month/CalendarMonthContext';
import { useCalendarRootContext } from '../../calendar/root/CalendarRootContext';
import { useRangeCalendarDayContext } from '../day/RangeCalendarDayContext';
import { rangeDayStateAttributesMapping } from '../day/stateAttributesMapping';
import { useRangeCalendarRootContext } from '../root/RangeCalendarRootContext';

defineOptions({ inheritAttrs: false });

const FULL_DATE: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
};

const props = withDefaults(defineProps<RangeCalendarDayButtonProps>(), {
  as: 'button',
  nativeButton: true,
});

defineSlots<{
  default(props: { state: RangeCalendarDayButtonState; text: string }): unknown;
  render(props: { props: HTMLProps; state: RangeCalendarDayButtonState; text: string }): unknown;
}>();

const root = useCalendarRootContext();
const range = useRangeCalendarRootContext();
const { day, state } = useRangeCalendarDayContext();
const { isLeaving } = useCalendarMonthContext();
const isHydrating = useIsHydrating();

// The button of a month that leaves has no tab stop, and the root does not focus it.
const isTabStop = computed(
  () => !isLeaving.value && root.tabStop.value !== null && isSameDay(root.tabStop.value, day.value),
);
const text = computed(() => formatText(day.value, { day: 'numeric' }, root.locale.value));
const label = computed(() => formatText(day.value, props.format ?? FULL_DATE, root.locale.value));

const { getButtonProps, buttonRef } = useButton({
  disabled: () => state.value.disabled,
  native: () => props.nativeButton,
});

function onClick(event: MouseEvent) {
  // The click after a drag is not a press: the pointer went down and up on different days.
  if (!range.takeClickSuppression(event)) {
    root.pressDay(day.value, event);
  }
}

function onFocusin(event: FocusEvent) {
  root.onDayFocus(day.value, event);
  range.preview(day.value);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && range.cancel(event)) {
    event.preventDefault();
    return;
  }
  root.onDayKeydown(day.value, event);
}

function onPointerenter(event: PointerEvent) {
  if (event.pointerType !== 'touch') {
    range.preview(day.value);
  }
}

// A drag holds the pointer on the button that it started on, and `dayAtPoint` finds the day under
// the pointer.
function onPointerdown(event: PointerEvent) {
  if (event.button !== 0 || !range.beginDrag(day.value, event.pointerId)) {
    return;
  }
  try {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  } catch {
    // The method throws for a pointer that the browser does not know, such as the pointer of an
    // event that a script dispatched. The drag then continues with the events of the button.
  }
}

function onPointermove(event: PointerEvent) {
  if (range.isDragging(event.pointerId)) {
    const date = range.dayAtPoint(event.currentTarget as Element, event.clientX, event.clientY);
    if (date) {
      range.dragTo(date);
    }
  }
}

function endPointer(event: PointerEvent) {
  const button = event.currentTarget as HTMLElement;
  // `pointercancel` releases the capture by itself, and a release of a capture that is gone throws.
  if (button.hasPointerCapture(event.pointerId)) {
    button.releasePointerCapture(event.pointerId);
  }
}

function onPointerup(event: PointerEvent) {
  if (range.isDragging(event.pointerId)) {
    range.endDrag(
      range.dayAtPoint(event.currentTarget as Element, event.clientX, event.clientY),
      event,
    );
    endPointer(event);
  }
}

function onPointercancel(event: PointerEvent) {
  if (range.isDragging(event.pointerId)) {
    range.cancelDrag();
    endPointer(event);
  }
}

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
        // A finger that drags over the days must not scroll the page.
        style: { touchAction: 'none' },
        onClick,
        onFocusin,
        onKeydown,
        onPointercancel,
        onPointerdown,
        onPointerenter,
        onPointermove,
        onPointerup,
      },
      attrs,
      getButtonProps,
    ];
  },
  stateAttributesMapping: rangeDayStateAttributesMapping,
});

// The root focuses a day after a key moves the focus, and it finds the button of the day here. A
// drag finds the day under the pointer here too.
watch(
  [element, day, isLeaving],
  ([button, date, leaving], _previous, onCleanup) => {
    if (button && !leaving) {
      onCleanup(root.registerDay(date, button));
      onCleanup(range.registerButton(button, () => date));
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
