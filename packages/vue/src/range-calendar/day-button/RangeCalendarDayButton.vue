<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
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
import { useDayButton } from '../../calendar/day-button/useDayButton';
import type { HTMLProps } from '../../internals/types';
import { useCalendarRootContext } from '../../calendar/root/CalendarRootContext';
import {
  useRangeCalendarDayContext,
  rangeDayStateAttributesMapping,
  useRangeCalendarRootContext,
} from '../root/RangeCalendarRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<RangeCalendarDayButtonProps>(), {
  as: 'button',
  nativeButton: true,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('RangeCalendar.DayButton');
}

defineSlots<{
  default(props: { state: RangeCalendarDayButtonState; text: string }): unknown;
  render(props: { props: HTMLProps; state: RangeCalendarDayButtonState; text: string }): unknown;
}>();

const root = useCalendarRootContext();
const range = useRangeCalendarRootContext();
const { day, state } = useRangeCalendarDayContext();

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
  if (!range.isDragging(event.pointerId)) {
    return;
  }
  // A move with no button comes after a release that another element got, such as when the page
  // of the first day left during the drag. The drag ends at its last day, and a hover does not
  // move it.
  if (event.buttons === 0) {
    range.endDrag(null, event);
    return;
  }
  const date = range.dayAtPoint(event.currentTarget as Element, event.clientX, event.clientY);
  if (date) {
    range.dragTo(date);
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

// With no default slot and no `as`, the text is the only child of a static element. Vue allows a
// text mismatch only for such an element, so the template has a branch of its own for it.
const { element, elementProps, setRef, usesRenderSlot, text } = useDayButton(props, {
  day,
  state,
  stateAttributesMapping: rangeDayStateAttributesMapping,
  extraProps: {
    // A finger that drags over the days must not scroll the page.
    style: { touchAction: 'none' },
    onClick,
    onFocusin,
    onPointercancel,
    onPointerdown,
    onPointerenter,
    onPointermove,
    onPointerup,
  },
  // A drag finds the day under the pointer here.
  register: range.registerButton,
});

defineExpose({ element });
</script>

<template>
  <slot
    v-if="!state.hidden && usesRenderSlot()"
    name="render"
    :props="elementProps()"
    :state="state"
    :text="text"
  />
  <component
    :is="as"
    v-else-if="!state.hidden && ($slots.default || as !== 'button')"
    v-bind="elementProps()"
    :ref="setRef"
    ><slot :state="state" :text="text">{{ text }}</slot></component
  >
  <button v-else-if="!state.hidden" v-bind="elementProps()" :ref="setRef">{{ text }}</button>
</template>
