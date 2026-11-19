<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TimeClockRootState } from '../root/TimeClockRoot.vue';
import type { TimeClockView } from '../utils/clockViews';

export interface TimeClockFaceState extends TimeClockRootState {}

export interface TimeClockFaceProps
  extends
    VaseUIComponentProps<TimeClockFaceState>,
    /* @vue-ignore */ WithVaseUIEvent<
      HTMLAttributes,
      'aria-describedby' | 'aria-label' | 'aria-labelledby'
    > {
  /**
   * A string value forwarded to the `aria-label` attribute of the `input`.
   * It replaces the default name, which is the name of the view (such as "hour").
   */
  ariaLabel?: string | undefined;
  /**
   * A string value forwarded to the `aria-labelledby` attribute of the `input`.
   * It replaces the default name.
   */
  ariaLabelledby?: string | undefined;
  /**
   * A string value forwarded to the `aria-describedby` attribute of the `input`.
   */
  ariaDescribedby?: string | undefined;
  /**
   * A function which returns a string value for the [`aria-valuetext`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-valuetext) attribute of the `input`.
   * It replaces the default text, which is the number with its unit (such as "30 minutes").
   * This is important for screen reader users.
   */
  getAriaValueText?: ((value: number, view: TimeClockView) => string) | null | undefined;
}
</script>

<script setup lang="ts">
import { computed, onScopeDispose, provide, shallowRef } from 'vue';
import type { Component } from 'vue';
import { formatNumber } from '../../common/formatNumber';
import { useAriaAfterHydration } from '../../common/hydration';
import { visuallyHiddenInput } from '../../common/visuallyHidden';
import {
  ARROW_DOWN,
  ARROW_LEFT,
  ARROW_RIGHT,
  ARROW_UP,
  END,
  HOME,
  PAGE_DOWN,
  PAGE_UP,
} from '../../internals/composite/listIndex';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createVaseUIEventDetails';
import { useInputRegistration } from '../../internals/field-register-control';
import { given } from '../../internals/givenAttributes';
import { REASONS } from '../../internals/reasons';
import type { HTMLProps } from '../../internals/types';
import { useElementRegistration } from '../../internals/useElementRegistration';
import { useInputRender } from '../../internals/useInputRender';
import { useRenderElement } from '../../internals/useRenderElement';
import { useFormatLocale } from '../../utils/useFormatLocale';
import { TimeClockFaceContext, useTimeClockRootContext } from '../root/TimeClockRootContext';
import {
  angleOfPoint,
  faceNumber,
  faceNumberOfPoint,
  outerRingRadius,
  pagePlaces,
  ratioOfPoint,
} from '../utils/clockViews';
import type { TimeClockFaceNumber } from '../utils/clockViews';
import TimeClockFaceChildren from './TimeClockFaceChildren.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimeClockFaceProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: TimeClockFaceState }): unknown;
  /**
   * Renders one number of the face. The face has no numbers until it has this slot.
   */
  number(props: { number: TimeClockFaceNumber; index: number }): unknown;
  render(props: { props: HTMLProps; state: TimeClockFaceState; children: Component }): unknown;
}>();

// The input fills the face, so that the focus ring of a screen reader fits the face. The face is
// the containing block of the input, as it is of the hand and the numbers.
const HIDDEN_INPUT_STYLE = {
  ...visuallyHiddenInput,
  inset: 0,
  margin: 0,
  width: '100%',
  height: '100%',
};

const root = useTimeClockRootContext();
const { grid, state } = root;
const formatLocale = useFormatLocale(root.locale);
const ariaAfterHydration = useAriaAfterHydration();

const inputElement = shallowRef<HTMLInputElement | null>(null);
useInputRegistration(inputElement, root.registerInput);
const { valueProps, renderValue } = useInputRender();
const numberElements = new Map<Element, () => TimeClockFaceNumber>();
// The pointer of the press or drag that is in progress, the radius of the outer ring that it
// measured, and whether it selected a number.
let activePointerId: number | null = null;
let pressRadius = 0;
let pressSelected = false;

const label = computed(() =>
  new Intl.DisplayNames(formatLocale.value, { type: 'dateTimeField' }).of(root.view.value),
);
const valueText = computed(() =>
  formatNumber(root.selectedNumber.value.value, formatLocale.value, {
    style: 'unit',
    unit: root.view.value,
    unitDisplay: 'long',
  }),
);

function onInput(event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  root.selectNumber(
    faceNumber(root.view.value, root.hourCycle.value, input.valueAsNumber),
    createChangeEventDetails(REASONS.inputChange, event),
  );
  renderValue();
}

function inputProps() {
  const ariaLabelledby = given('aria-labelledby', props.ariaLabelledby);
  return {
    'aria-label':
      ariaAfterHydration(
        given('aria-label', props.ariaLabel) ?? (ariaLabelledby == null ? label.value : undefined),
      ) ?? undefined,
    'aria-labelledby': ariaLabelledby,
    'aria-describedby': given('aria-describedby', props.ariaDescribedby),
    'aria-readonly': state.value.readOnly ? 'true' : undefined,
    'aria-valuenow': root.selectedNumber.value.value,
    'aria-valuetext':
      ariaAfterHydration(
        typeof props.getAriaValueText === 'function'
          ? props.getAriaValueText(root.selectedNumber.value.value, root.view.value)
          : valueText.value,
      ) ?? undefined,
    // A browser restores the value of an input that has no `autocomplete="off"` after a reload.
    autocomplete: 'off',
    disabled: state.value.disabled,
    max: grid.value.first + grid.value.count - 1,
    min: grid.value.first,
    onInput,
    step: grid.value.step,
    style: HIDDEN_INPUT_STYLE,
    type: 'range',
    ...valueProps(root.selectedNumber.value.value),
  };
}

provide(TimeClockFaceContext, {
  inputProps,
  setInputElement(value) {
    inputElement.value = value as HTMLInputElement | null;
  },
  useNumber(element, number) {
    useElementRegistration(numberElements, element, number);
  },
});

// The style sheet of the consumer places the numbers, so a press measures the outer ring.
function measureOuterRing(face: HTMLElement): number {
  const outerNumbers = [...numberElements]
    .filter(([, number]) => !number().inner)
    .map(([element]) => element.getBoundingClientRect());
  return outerRingRadius(face.getBoundingClientRect(), outerNumbers);
}

function selectNumberOfEvent(event: PointerEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const point = { x: event.clientX, y: event.clientY };
  const number = faceNumberOfPoint(
    root.view.value,
    root.hourCycle.value,
    grid.value.step,
    angleOfPoint(point, rect),
    ratioOfPoint(point, rect, pressRadius),
  );
  if (root.selectNumber(number, createChangeEventDetails(REASONS.drag, event))) {
    pressSelected = true;
  }
}

function endPress(event: PointerEvent) {
  activePointerId = null;
  const face = event.currentTarget as HTMLElement;
  // `pointercancel` releases the capture by itself, and a release of a capture that is gone throws.
  if (face.hasPointerCapture(event.pointerId)) {
    face.releasePointerCapture(event.pointerId);
  }
  root.setDragging(false);
}

function onPointerdown(event: PointerEvent) {
  if (event.button !== 0 || state.value.disabled || state.value.readOnly) {
    return;
  }
  const face = event.currentTarget as HTMLElement;
  // A press in progress holds the capture. No capture means that its release went missing.
  if (activePointerId !== null && face.hasPointerCapture(activePointerId)) {
    return;
  }
  activePointerId = event.pointerId;
  pressRadius = measureOuterRing(face);
  pressSelected = false;
  try {
    face.setPointerCapture(event.pointerId);
  } catch {
    // The method throws for a pointer that the browser does not know, such as the pointer of an
    // event that a script dispatched. The press then ends with the events of the face.
  }
  root.setDragging(true);
  // The press cancels the default action, so the browser does not move the focus or select text.
  event.preventDefault();
  inputElement.value?.focus({ preventScroll: true });
  selectNumberOfEvent(event);
}

function onPointermove(event: PointerEvent) {
  if (event.pointerId === activePointerId) {
    selectNumberOfEvent(event);
  }
}

// A press that selected no number, such as a press on a disabled number, commits nothing.
function onPointerup(event: PointerEvent) {
  if (event.pointerId !== activePointerId) {
    return;
  }
  endPress(event);
  if (pressSelected) {
    root.commit(createGenericEventDetails(REASONS.drag, event));
  }
}

function onPointercancel(event: PointerEvent) {
  if (event.pointerId === activePointerId) {
    endPress(event);
  }
}

// The key events of the range input reach the face. A key that another control in the face gets is
// not a key of the slider.
function onKeydown(event: KeyboardEvent) {
  if (
    event.defaultPrevented ||
    event.target !== inputElement.value ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey
  ) {
    return;
  }
  const details = () => createChangeEventDetails(REASONS.keyboard, event);
  switch (event.key) {
    case ARROW_RIGHT:
    case ARROW_UP:
      root.stepNumber(1, details());
      break;
    case ARROW_LEFT:
    case ARROW_DOWN:
      root.stepNumber(-1, details());
      break;
    case PAGE_UP:
      root.stepNumber(pagePlaces(root.view.value, grid.value.step), details());
      break;
    case PAGE_DOWN:
      root.stepNumber(-pagePlaces(root.view.value, grid.value.step), details());
      break;
    case HOME:
      root.selectEdge('first', details());
      break;
    case END:
      root.selectEdge('last', details());
      break;
    case 'Enter':
    case ' ':
      root.commit(createGenericEventDetails(REASONS.keyboard, event));
      break;
    default:
      return;
  }
  event.preventDefault();
}

onScopeDispose(() => {
  if (activePointerId !== null) {
    root.setDragging(false);
  }
});

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  props: (attrs) => [
    {
      onKeydown,
      onPointercancel,
      onPointerdown,
      onPointermove,
      onPointerup,
      style: { touchAction: 'none' },
    },
    attrs,
  ],
  children: true,
});

defineExpose({ element, inputElement });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" :children="TimeClockFaceChildren" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <TimeClockFaceChildren>
      <slot :state="state" />
      <template v-if="$slots.number" #number="slotProps"><slot name="number" v-bind="slotProps" /></template>
    </TimeClockFaceChildren>
  </component>
</template>
