<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { CalendarState } from '../root/CalendarRoot.vue';

export interface CalendarCaptionState extends CalendarState {}

export interface CalendarCaptionProps
  extends
    VaseUIComponentProps<CalendarCaptionState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<HTMLAttributes>, 'id'> {
  /**
   * The id of the element. The grid of the month is named by this element.
   */
  id?: string | undefined;
  /**
   * The format of the name of the month, as the options of `Intl.DateTimeFormat`. The default is
   * the long name of the month and the year. For a page of weeks or days, it is the format of the
   * first day and of the last day of the page.
   */
  format?: Intl.DateTimeFormatOptions | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { useIsHydrating } from '../../common/hydration';
import { formatPage } from '../../internals/date-time/calendar/formatText';
import type { HTMLProps } from '../../internals/types';
import { useInitialLiveRegionTextMutation } from '../../internals/useInitialLiveRegionTextMutation';
import { useRenderElement } from '../../internals/useRenderElement';
import { useRegisteredLabelId } from '../../utils/useRegisteredLabelId';
import { useCalendarMonthContext } from '../month/CalendarMonthContext';
import { useCalendarRootContext } from '../root/CalendarRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarCaptionProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: CalendarCaptionState; text: string }): unknown;
  render(props: { props: HTMLProps; state: CalendarCaptionState; text: string }): unknown;
}>();

const { state, locale, navigationDirection } = useCalendarRootContext();
const { month, setLabelId, defaultLabelId } = useCalendarMonthContext();
const captionId = useRegisteredLabelId(() => props.id, setLabelId, defaultLabelId);
const isHydrating = useIsHydrating();

const text = computed(() => formatPage(month.value, locale.value, props.format));

// A page change mounts a new caption, and a screen reader does not read the text of a live region
// that is new. A mutation of the text after the mount makes it read the month. The caption of the
// first page has no such change.
const liveRegionRef = useInitialLiveRegionTextMutation<HTMLElement>(
  () => navigationDirection.value !== 'none',
);

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: liveRegionRef,
  props: (attrs) => [
    {
      id: captionId.value,
      'aria-live': 'polite',
      // The names of the months come from the data of `Intl` in the engine, and a server and a
      // browser can differ.
      'data-allow-mismatch': isHydrating.value ? 'text' : undefined,
    },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" :text="text" />
  <component :is="as" v-else v-bind="elementProps()"
    ><slot :state="state" :text="text">{{ text }}</slot></component
  >
</template>
