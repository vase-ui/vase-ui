<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  NativeButtonProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';
import type { TimeClockRootState } from '../root/TimeClockRoot.vue';
import type { TimeClockView } from '../utils/clockViews';

export interface TimeClockViewTriggerState extends TimeClockRootState {
  /**
   * Whether the face shows the unit of the trigger.
   */
  active: boolean;
}

export interface TimeClockViewTriggerProps
  extends
    NativeButtonProps,
    VaseUIComponentProps<TimeClockViewTriggerState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<ButtonHTMLAttributes>, 'disabled'> {
  /**
   * The unit that the face shows when the user presses the trigger.
   * The text of the trigger is that unit of the time, with two digits.
   */
  view: TimeClockView;
}
</script>

<script setup lang="ts">
import { computed, useSlots } from 'vue';
import { formatNumber } from '../../common/formatNumber';
import { useIsHydrating } from '../../common/hydration';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useButton } from '../../internals/use-button/useButton';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useRenderElement } from '../../internals/useRenderElement';
import { useFormatLocale } from '../../utils/useFormatLocale';
import { useTimeClockRootContext } from '../root/TimeClockRootContext';
import { faceNumberOf } from '../utils/clockViews';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimeClockViewTriggerProps>(), {
  as: 'button',
  nativeButton: true,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('TimeClock.ViewTrigger');
}

defineSlots<{
  default(props: { state: TimeClockViewTriggerState }): unknown;
  render: ComponentRenderFn<HTMLProps, TimeClockViewTriggerState>;
}>();

const slots = useSlots();
const root = useTimeClockRootContext();
const formatLocale = useFormatLocale(root.locale);
const isHydrating = useIsHydrating();

const state = computed<TimeClockViewTriggerState>(() => ({
  ...root.state.value,
  active: root.view.value === props.view,
}));

// A clock that has no value shows a placeholder, as an empty field does.
// With no default slot and no `as`, the text is the only child of a static element. Vue allows a
// text mismatch only for such an element, so the template has a branch of its own for it.
const text = computed(() =>
  root.state.value.empty
    ? '--'
    : formatNumber(
        faceNumberOf(props.view, root.hourCycle.value, root.time.value).value,
        formatLocale.value,
        { minimumIntegerDigits: 2, useGrouping: false },
      ),
);

// The text is a number, so the name says which unit it is.
const label = computed(() => {
  const unit = new Intl.DisplayNames(formatLocale.value, { type: 'dateTimeField' }).of(props.view);
  return root.state.value.empty ? unit : `${unit} ${text.value}`;
});

function onClick(event: MouseEvent) {
  root.setView(props.view, createChangeEventDetails(REASONS.triggerPress, event));
}

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('button', props, {
  button: (element) =>
    useButton(element, {
      disabled: () => root.state.value.disabled,
      native: () => props.nativeButton,
    }),
  state,
  props: (attrs) => {
    // A trigger is never a submit button and never a part of a form.
    const { form, type, ...elementAttrs } = attrs;
    return [
      {
        'aria-label': slots.default ? undefined : label.value,
        'aria-pressed': state.value.active,
        // A server and a browser can have another version of the `Intl` data.
        'data-allow-mismatch': isHydrating.value ? 'text' : undefined,
        onClick,
      },
      elementAttrs,
    ];
  },
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component
    :is="as"
    v-else-if="$slots.default || as !== 'button'"
    v-bind="elementProps()"
    :ref="setRef"
    ><slot :state="state">{{ text }}</slot></component
  >
  <button v-else v-bind="elementProps()" :ref="setRef">{{ text }}</button>
</template>
