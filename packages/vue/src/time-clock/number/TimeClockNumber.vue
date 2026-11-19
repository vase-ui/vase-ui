<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TimeClockRootState } from '../root/TimeClockRoot.vue';
import type { TimeClockFaceNumber } from '../utils/clockViews';

export type { TimeClockFaceNumber } from '../utils/clockViews';

export interface TimeClockNumberState extends TimeClockRootState {
  /**
   * Whether the user cannot select the number, or the clock is disabled.
   */
  disabled: boolean;
  /**
   * Whether the time of the clock selects the number.
   */
  selected: boolean;
  /**
   * Whether the number is on the inner ring of a 24-hour face.
   */
  inner: boolean;
}

export interface TimeClockNumberProps
  extends
    VaseUIComponentProps<TimeClockNumberState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * The number of the face that the part shows.
   * The `number` slot of `TimeClock.Face` gives it.
   */
  number: TimeClockFaceNumber;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { formatNumber } from '../../common/formatNumber';
import { useIsHydrating } from '../../common/hydration';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useFormatLocale } from '../../utils/useFormatLocale';
import { useTimeClockFaceContext, useTimeClockRootContext } from '../root/TimeClockRootContext';
import { angleOfFaceNumber, radiusOfFaceNumber } from '../utils/clockViews';
import * as TimeClockNumberCssVars from './TimeClockNumberCssVars';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimeClockNumberProps>(), { as: 'span' });

defineSlots<{
  default(props: { state: TimeClockNumberState }): unknown;
  render: ComponentRenderFn<HTMLProps, TimeClockNumberState>;
}>();

const root = useTimeClockRootContext();
const face = useTimeClockFaceContext(true);
const formatLocale = useFormatLocale(root.locale);
const isHydrating = useIsHydrating();

const state = computed<TimeClockNumberState>(() => {
  const { number } = props;
  const { selectedNumber } = root;
  return {
    ...root.state.value,
    disabled: root.state.value.disabled || root.isNumberDisabled(number),
    selected:
      !root.state.value.empty &&
      number.value === selectedNumber.value.value &&
      number.inner === selectedNumber.value.inner,
    inner: number.inner,
  };
});

// A minute, a second and the hour 0 have two digits, as the time shows them.
// With no default slot and no `as`, the text is the only child of a static element. Vue allows a
// text mismatch only for such an element, so the template has a branch of its own for it.
const text = computed(() =>
  formatNumber(props.number.value, formatLocale.value, {
    minimumIntegerDigits: root.view.value !== 'hour' || props.number.value === 0 ? 2 : 1,
    useGrouping: false,
  }),
);

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('span', props, {
  state,
  props: (attrs) => [
    {
      'aria-hidden': 'true',
      // A server and a browser can have another version of the `Intl` data.
      'data-allow-mismatch': isHydrating.value ? 'text' : undefined,
      style: {
        [TimeClockNumberCssVars.timeClockNumberAngle]: `${angleOfFaceNumber(root.view.value, props.number)}deg`,
        [TimeClockNumberCssVars.timeClockNumberRadius]: radiusOfFaceNumber(props.number),
      },
    },
    attrs,
  ],
});

face?.useNumber(element, () => props.number);

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component
    :is="as"
    v-else-if="$slots.default || as !== 'span'"
    v-bind="elementProps()"
    :ref="setRef"
    ><slot :state="state">{{ text }}</slot></component
  >
  <span v-else v-bind="elementProps()" :ref="setRef">{{ text }}</span>
</template>
