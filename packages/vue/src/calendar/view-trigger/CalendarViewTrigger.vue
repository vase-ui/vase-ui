<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';
import type { CalendarState } from '../root/CalendarRoot.vue';

export interface CalendarViewTriggerState extends CalendarState {
  /**
   * The view that a press shows: `month` or `year`.
   */
  view: 'month' | 'year';
  /**
   * Whether the grid shows that view now.
   */
  active: boolean;
}

export interface CalendarViewTriggerProps
  extends
    NativeButtonProps,
    VaseUIComponentProps<CalendarViewTriggerState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<ButtonHTMLAttributes>, 'disabled'> {
  /**
   * The view that a press shows. A press while the grid shows that view shows the first view again:
   * the days, or the months for a value that is a year and month.
   * @default 'year'
   */
  view?: 'month' | 'year' | undefined;
  /**
   * Whether the button should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { useIsHydrating } from '../../common/hydration';
import type { HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useRenderElement } from '../../internals/useRenderElement';
import { useCalendarRootContext } from '../root/CalendarRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CalendarViewTriggerProps>(), {
  as: 'button',
  nativeButton: true,
  view: 'year',
  disabled: false,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Calendar.ViewTrigger');
}

defineSlots<{
  default(props: { state: CalendarViewTriggerState; text: string }): unknown;
  render(props: { props: HTMLProps; state: CalendarViewTriggerState; text: string }): unknown;
}>();

const root = useCalendarRootContext();
const isHydrating = useIsHydrating();

// A calendar with `visibleDuration` shows days only, so a press could not show another view.
const isDisabled = computed(
  () => props.disabled || root.state.value.disabled || !root.hasViews.value,
);
const state = computed<CalendarViewTriggerState>(() => ({
  ...root.state.value,
  disabled: isDisabled.value,
  view: props.view,
  active: root.view.value === props.view,
}));
const text = root.label;

const { getButtonProps, buttonRef } = useButton({
  disabled: isDisabled,
  native: () => props.nativeButton,
});

const { element, elementProps } = useRenderElement('button', props, {
  state,
  ref: buttonRef,
  props: (attrs) => [
    {
      // The name starts with the visible text, so that voice control finds the button by it.
      'aria-label': `${text.value}, ${props.view === 'month' ? 'choose the month' : 'choose the year'}`,
      // The text changes in place when a button moves the pages, so a screen reader reads it.
      'aria-live': 'polite',
      // The name of the month and the digits of the year come from the data of `Intl` in the
      // engine, and a server and a browser can differ.
      'data-allow-mismatch': isHydrating.value ? 'text' : undefined,
      onClick: (event: MouseEvent) => {
        root.toggleView(props.view, event);
      },
    },
    attrs,
    getButtonProps,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" :text="text" />
  <component :is="as" v-else-if="$slots.default || as !== 'button'" v-bind="elementProps()"
    ><slot :state="state" :text="text">{{ text }}</slot></component
  >
  <button v-else v-bind="elementProps()">{{ text }}</button>
</template>
