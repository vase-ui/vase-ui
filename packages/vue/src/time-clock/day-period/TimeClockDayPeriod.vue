<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';
import type { TimeClockRootState } from '../root/TimeClockRoot.vue';
import type { TimeClockDayPeriodValue } from '../utils/clockViews';

export type { TimeClockDayPeriodValue } from '../utils/clockViews';

export interface TimeClockDayPeriodState extends TimeClockRootState {
  /**
   * Whether the user cannot select the day period, or the clock is disabled.
   */
  disabled: boolean;
  /**
   * Whether the time of the clock is in the day period.
   */
  selected: boolean;
}

export interface TimeClockDayPeriodProps
  extends
    NativeButtonProps,
    VaseUIComponentProps<TimeClockDayPeriodState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<ButtonHTMLAttributes>, 'disabled' | 'value'> {
  /**
   * The day period that the part selects.
   * The text of the part is the text of that day period in the locale.
   */
  value: TimeClockDayPeriodValue;
}
</script>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useIsHydrating } from '../../common/hydration';
import { ownerDocument } from '../../common/owner';
import { activeElement, contains } from '../../common/shadowDom';
import { dayPeriodText } from '../../internals/date-time/format';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button/useButton';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useRenderElement } from '../../internals/useRenderElement';
import { useFormatLocale } from '../../utils/useFormatLocale';
import { useTimeClockRootContext } from '../root/TimeClockRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimeClockDayPeriodProps>(), {
  as: 'button',
  nativeButton: true,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('TimeClock.DayPeriod');
}

defineSlots<{
  default(props: { state: TimeClockDayPeriodState }): unknown;
  render: ComponentRenderFn<HTMLProps, TimeClockDayPeriodState>;
}>();

const root = useTimeClockRootContext();
const formatLocale = useFormatLocale(root.locale);
const isHydrating = useIsHydrating();
// A 24-hour face has no day period, so the part renders nothing.
const isTwelveHour = computed(() => root.hourCycle.value === 12);

const state = computed<TimeClockDayPeriodState>(() => ({
  ...root.state.value,
  disabled: root.state.value.disabled || root.isDayPeriodDisabled(props.value),
  selected: !root.state.value.empty && root.dayPeriod.value === props.value,
}));

// With no default slot and no `as`, the text is the only child of a static element. Vue allows a
// text mismatch only for such an element, so the template has a branch of its own for it.
const text = computed(() => dayPeriodText(props.value, formatLocale.value));

function onClick(event: MouseEvent) {
  root.selectDayPeriod(props.value, createChangeEventDetails(REASONS.itemPress, event));
}

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('button', props, {
  button: (element) =>
    useButton(element, {
      disabled: () => state.value.disabled,
      native: () => props.nativeButton,
    }),
  state,
  props: (attrs) => {
    // A day period is never a submit button and never a part of a form.
    const { form, type, ...elementAttrs } = attrs;
    return [
      {
        'aria-pressed': state.value.selected,
        // A server and a browser can have another version of the `Intl` data.
        'data-allow-mismatch': isHydrating.value ? 'text' : undefined,
        onClick,
      },
      elementAttrs,
    ];
  },
});

// When Vue removes a focused element, the browser moves the focus to `<body>`. The face takes the
// focus before the update, so a popup finds no lost focus to restore.
watch(isTwelveHour, (twelveHour) => {
  const dayPeriodElement = element.value;
  if (
    !twelveHour &&
    dayPeriodElement !== null &&
    contains(dayPeriodElement, activeElement(ownerDocument(dayPeriodElement)))
  ) {
    root.focusInput();
  }
});

defineExpose({ element });
</script>

<template>
  <slot
    v-if="isTwelveHour && usesRenderSlot()"
    name="render"
    :props="elementProps()"
    :state="state"
  />
  <component
    :is="as"
    v-else-if="isTwelveHour && ($slots.default || as !== 'button')"
    v-bind="elementProps()"
    :ref="setRef"
    ><slot :state="state">{{ text }}</slot></component
  >
  <button v-else-if="isTwelveHour" v-bind="elementProps()" :ref="setRef">{{ text }}</button>
</template>
