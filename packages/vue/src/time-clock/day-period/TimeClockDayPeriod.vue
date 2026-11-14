<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';
import type { TimeClockRootState } from '../root/TimeClockRoot.vue';
import type { TimeClockDayPeriod } from '../utils/clockViews';

export type { TimeClockDayPeriod } from '../utils/clockViews';

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
  value: TimeClockDayPeriod;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { useIsHydrating } from '../../common/hydration';
import { formatter } from '../../internals/date-time/format';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { useRenderElement } from '../../internals/useRenderElement';
import { useFormatLocale } from '../../utils/useFormatLocale';
import { useTimeClockRootContext } from '../root/TimeClockRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimeClockDayPeriodProps>(), {
  as: 'button',
  nativeButton: true,
});

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
  disabled: root.disabled.value || root.isDayPeriodDisabled(props.value),
  selected: !root.empty.value && root.dayPeriod.value === props.value,
}));

// The text is the day period of 9:00 or 21:00 in a 12-hour format of the locale.
const text = computed(() => {
  const [format, epochMilliseconds] = formatter(
    new Temporal.PlainTime(props.value === 'pm' ? 21 : 9),
    { hour: 'numeric', hour12: true },
    formatLocale.value,
  );
  return (
    format.formatToParts(epochMilliseconds).find((part) => part.type === 'dayPeriod')?.value ??
    props.value.toUpperCase()
  );
});

const { getButtonProps, buttonRef } = useButton({
  disabled: () => state.value.disabled,
  native: () => props.nativeButton,
});

function onClick(event: MouseEvent) {
  root.selectDayPeriod(props.value, createChangeEventDetails(REASONS.itemPress, event));
}

const { element, elementProps } = useRenderElement('button', props, {
  state,
  ref: buttonRef,
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
      getButtonProps,
    ];
  },
});

defineExpose({ element });
</script>

<template>
  <slot v-if="isTwelveHour && $slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else-if="isTwelveHour" v-bind="elementProps()"
    ><slot :state="state">{{ text }}</slot></component
  >
</template>
