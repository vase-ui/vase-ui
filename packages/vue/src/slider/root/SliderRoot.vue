<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type {
  VaseUIChangeEventDetails,
  VaseUIGenericEventDetails,
} from '../../internals/createVaseUIEventDetails';
import type { FieldRootState } from '../../internals/field-root-context/FieldRootContext';
import { REASONS } from '../../internals/reasons';
import type { Orientation, VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { ThumbCollisionBehavior } from '../utils/resolveThumbCollision';

export interface SliderRootState extends FieldRootState {
  /**
   * The index of the active thumb.
   */
  activeThumbIndex: number;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the thumb is currently being dragged.
   */
  dragging: boolean;
  /**
   * The maximum value.
   */
  max: number;
  /**
   * The minimum value.
   */
  min: number;
  /**
   * The minimum steps between values in a range slider.
   * @default 0
   */
  minStepsBetweenValues: number;
  /**
   * The component orientation.
   */
  orientation: Orientation;
  /**
   * The step increment of the slider when incrementing or decrementing. It will snap
   * to multiples of this value. Decimal values are supported.
   * @default 1
   */
  step: number;
  /**
   * The raw number value of the slider.
   */
  values: readonly number[];
}

export interface SliderRootProps<
  Value extends number | readonly number[] = number | readonly number[],
>
  extends
    VaseUIComponentProps<SliderRootState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<HTMLAttributes, 'aria-labelledby'>, 'id'> {
  /**
   * The uncontrolled value of the slider when it's initially rendered.
   *
   * To render a controlled slider, use the `modelValue` prop instead.
   */
  defaultValue?: Value | undefined;
  /**
   * Whether the slider should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Options to format the value.
   */
  format?: Intl.NumberFormatOptions | undefined;
  /**
   * The locale used by `Intl.NumberFormat` when formatting the value.
   * Defaults to the user's runtime locale.
   * When server rendering, `en-US` is used until hydration.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * The maximum allowed value of the slider.
   * Should not be equal to min.
   * @default 100
   */
  max?: number | undefined;
  /**
   * The minimum allowed value of the slider.
   * Should not be equal to max.
   * @default 0
   */
  min?: number | undefined;
  /**
   * The minimum steps between values in a range slider.
   * @default 0
   */
  minStepsBetweenValues?: number | undefined;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the slider inputs.
   * Useful when the slider is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * The component orientation.
   * @default 'horizontal'
   */
  orientation?: Orientation | undefined;
  /**
   * The granularity with which the slider can step through values. (A "discrete" slider.)
   * The `min` prop serves as the origin for the valid values.
   * We recommend (max - min) to be evenly divisible by the step.
   * @default 1
   */
  step?: number | undefined;
  /**
   * The granularity with which the slider can step through values when using Page Up/Page Down or Shift + Arrow Up/Arrow Down.
   * @default 10
   */
  largeStep?: number | undefined;
  /**
   * How the thumb(s) are aligned relative to `Slider.Control` when the value is at `min` or `max`:
   * - `center`: The center of the thumb is aligned with the control edge
   * - `edge`: The thumb is inset within the control such that its edge is aligned with the control edge
   * - `edge-client-only`: Same as `edge`, but the server HTML has no script that places the thumb. The thumb stays hidden until it is mounted.
   * @default 'center'
   */
  thumbAlignment?: 'center' | 'edge' | 'edge-client-only' | undefined;
  /**
   * Controls how thumbs behave when they collide during pointer interactions.
   *
   * - `'push'` (default): Thumbs push each other without restoring their previous positions when dragged back.
   * - `'swap'`: Thumbs swap places when dragged past each other.
   * - `'none'`: Thumbs cannot move past each other; excess movement is ignored.
   *
   * @default 'push'
   */
  thumbCollisionBehavior?: ThumbCollisionBehavior | undefined;
  /**
   * The value of the slider.
   * For range sliders, provide an array with one value per thumb.
   */
  modelValue?: Value | undefined;
  /**
   * The id of the root. The id of `Slider.Label` derives from it.
   */
  id?: string | undefined;
  /**
   * The ids of the elements that name the slider. They replace the label of the slider.
   */
  ariaLabelledby?: string | undefined;
}

export interface SliderRootChangeEventCustomProperties {
  /**
   * The index of the active thumb at the time of the change.
   */
  activeThumbIndex: number;
}

export type SliderRootChangeEventReason =
  | typeof REASONS.inputChange
  | typeof REASONS.trackPress
  | typeof REASONS.drag
  | typeof REASONS.keyboard
  | typeof REASONS.none;
export type SliderRootChangeEventDetails = VaseUIChangeEventDetails<
  SliderRootChangeEventReason,
  SliderRootChangeEventCustomProperties
>;

export type SliderRootCommitEventReason =
  | typeof REASONS.inputChange
  | typeof REASONS.trackPress
  | typeof REASONS.drag
  | typeof REASONS.keyboard
  | typeof REASONS.none;
export type SliderRootCommitEventDetails = VaseUIGenericEventDetails<SliderRootCommitEventReason>;
</script>

<script setup lang="ts" generic="Value extends number | readonly number[] = number">
// vue-tsc resolves `Value` before it checks a listener of a template.
// With no `modelValue` and no `defaultValue`, the value is `min`, so the default is `number`.
import { computed, provide, shallowRef, watch } from 'vue';
import { areArraysEqual } from '../../common/areArraysEqual';
import { clamp } from '../../common/clamp';
import { useIsHydrating } from '../../common/hydration';
import { ownerDocument } from '../../common/owner';
import { activeElement, contains } from '../../common/shadowDom';
import { useControlled } from '../../common/useControlled';
import { warn } from '../../common/warn';
import { useFieldsetDisabled } from '../../fieldset/root/useFieldsetDisabled';
import { useCompositeList } from '../../internals/composite/list/useCompositeList';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createVaseUIEventDetails';
import { useRegisterFieldControl } from '../../internals/field-register-control';
import { useClearFieldError, useFieldRootContext } from '../../internals/field-root-context';
import { useFormContext } from '../../internals/form-context';
import { given } from '../../internals/givenAttributes';
import { createLabelIdRegistry, useControlLabelId } from '../../internals/labelable-provider';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { useValueChanged } from '../../internals/useValueChanged';
import { asc } from '../utils/asc';
import { getSliderValue } from '../utils/getSliderValue';
import { validateMinimumDistance } from '../utils/validateMinimumDistance';
import { SliderRootContext } from './SliderRootContext';
import type { ThumbInput, ThumbMetadata } from './SliderRootContext';
import { sliderStateAttributesMapping } from './stateAttributesMapping';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SliderRootProps<Value>>(), {
  as: 'div',
  disabled: false,
  largeStep: 10,
  max: 100,
  min: 0,
  minStepsBetweenValues: 0,
  orientation: 'horizontal',
  step: 1,
  thumbAlignment: 'center',
  thumbCollisionBehavior: 'push',
  modelValue: undefined,
});

const emit = defineEmits<{
  /**
   * The first argument is the new value. Read the field name from the thumb input.
   * `eventDetails.event` is the original browser event, or a new `Event('vase-ui')` for a change without one.
   * The reason identifies the source of the change.
   *
   * - `'input-change'` when the hidden range input emits a change event (for example, via form integration)
   * - `'track-press'` when the control track is pressed
   * - `'drag'` while dragging a thumb
   * - `'keyboard'` for keyboard input
   * - `'none'` when the change is triggered without a specific interaction
   */
  valueChange: [
    value: Value extends number ? number : Value,
    eventDetails: SliderRootChangeEventDetails,
  ];
  /**
   * Event handler called after `valueChange` with the new value, unless a listener cancels the
   * change. `v-model` uses it.
   */
  'update:modelValue': [value: Value extends number ? number : Value];
  /**
   * Callback function that is fired when a value change is committed.
   * Does not fire if the value did not change, or if the change was canceled.
   * **Warning**: This is a generic event, not a change event.
   *
   * The `eventDetails.reason` indicates what triggered the commit:
   *
   * - `'drag'` while dragging a thumb
   * - `'track-press'` when the control track is pressed
   * - `'keyboard'` for keyboard input
   * - `'input-change'` when the hidden range input emits a change event (for example, via form integration)
   * - `'none'` when the commit occurs without a specific interaction
   */
  valueCommitted: [
    value: Value extends number ? number : Value,
    eventDetails: SliderRootCommitEventDetails,
  ];
}>();

defineSlots<{
  default(props: { state: SliderRootState }): unknown;
  render: ComponentRenderFn<HTMLProps, SliderRootState>;
}>();

function areValuesEqual(
  newValue: number | readonly number[],
  oldValue: number | readonly number[],
) {
  return (
    newValue === oldValue ||
    (Array.isArray(newValue) && Array.isArray(oldValue) && areArraysEqual(newValue, oldValue))
  );
}

const rootId = useVaseUiId(() => props.id);
const rootLabelId = computed(() => `${rootId.value}-label`);

const { clearErrors } = useFormContext();
const {
  state: fieldState,
  disabled: fieldDisabled,
  name: fieldName,
  setTouched,
  setDirty,
  validityData,
  validation,
} = useFieldRootContext();

// In a field, the root defers its server render. The label of the field can come after the root.
const fieldLabelId = useControlLabelId();
const { labelId: localLabelId, registerLabelId } = createLabelIdRegistry();
const isHydrating = useIsHydrating();

const labelId = computed(
  () => given('aria-labelledby', props.ariaLabelledby) ?? fieldLabelId.value ?? localLabelId.value,
);

const fieldsetDisabled = useFieldsetDisabled(() => element.value);
const isDisabled = computed(() => fieldDisabled.value || fieldsetDisabled.value || props.disabled);
const inputName = computed(() => fieldName.value ?? props.name);

// The internal value is potentially unsorted, e.g. to support frozen arrays
// https://github.com/mui/material-ui/pull/28472
const valueUnwrapped = useControlled<number | readonly number[]>({
  controlled: () => props.modelValue,
  default: () => props.defaultValue ?? props.min,
  name: 'Slider',
});

const controlElement = shallowRef<HTMLElement | null>(null);
const thumbRefs = shallowRef<(HTMLElement | null)[]>([]);
// The px distance between the pointer and the center of a pressed thumb.
const pressedThumbCenterOffsetRef = shallowRef<number | null>(null);
// The index of the pressed thumb, or the closest thumb if the `Control` was pressed.
// This is updated on pointerdown, which is sooner than the `active/activeIndex`
// state which is updated later when the nested `input` receives focus.
const pressedThumbIndexRef = shallowRef(-1);
// The values when the current drag interaction started.
const pressedValuesRef = shallowRef<readonly number[] | null>(null);
const lastChangeReasonRef = shallowRef<SliderRootChangeEventReason>(REASONS.none);

// We can't use the :active browser pseudo-classes.
// - The active state isn't triggered when clicking on the rail.
// - The active state isn't transferred when inversing a range slider.
const active = shallowRef(-1);
const lastUsedThumbIndex = shallowRef(-1);
const dragging = shallowRef(false);
const indicatorPosition = shallowRef<readonly [number | undefined, number | undefined]>([
  undefined,
  undefined,
]);

function setActive(value: number) {
  active.value = value;

  if (value !== -1) {
    lastUsedThumbIndex.value = value;
  }
}

function setIndicatorPosition(edge: 0 | 1, position: number | undefined) {
  const [start, end] = indicatorPosition.value;
  indicatorPosition.value = edge === 0 ? [position, end] : [start, position];
}

const thumbList = useCompositeList<ThumbMetadata>({
  elementsRef: thumbRefs,
  provide: false,
});

const range = computed(() => Array.isArray(valueUnwrapped.value));

const values = computed<readonly number[]>(() => {
  const unwrapped = valueUnwrapped.value;
  if (!Array.isArray(unwrapped)) {
    return [clamp(unwrapped as number, props.min, props.max)];
  }
  return unwrapped.map((value) => clamp(value, props.min, props.max)).sort(asc);
});

const fieldValue = computed(() => (range.value ? values.value : values.value[0]));

// The form focuses `validation.inputRef`.
useRegisterFieldControl(
  validation.inputRef,
  rootId,
  () => fieldValue.value,
  undefined,
  () => !isDisabled.value,
  () => props.name,
);

const clearFieldError = useClearFieldError(inputName);

// The change of a reset reaches `useValueChanged` after the reset timeout. A clear in the timeout
// would come before `validation.change`, and the validation could show a new error. The timeout sets
// this flag, and the callback clears the field and starts no validation.
let isResetChangePending = false;

useValueChanged(fieldValue, () => {
  clearErrors(inputName.value);

  if (isResetChangePending) {
    isResetChangePending = false;
    clearFieldError(fieldValue.value);
  } else {
    validation.change(fieldValue.value);
  }

  const initialValue = validityData.value.initialValue as number | readonly number[] | undefined;
  const current = fieldValue.value;
  let isDirty: boolean;
  if (Array.isArray(current) && Array.isArray(initialValue)) {
    isDirty = !areArraysEqual(current, initialValue);
  } else {
    isDirty = current !== initialValue;
  }
  setDirty(isDirty);
});

function setValue(newValue: number | number[], details: SliderRootChangeEventDetails) {
  if (Number.isNaN(newValue) || areValuesEqual(newValue, valueUnwrapped.value)) {
    return false;
  }

  emit('valueChange', newValue as Value extends number ? number : Value, details);

  if (details.isCanceled) {
    return false;
  }

  lastChangeReasonRef.value = details.reason;

  emit('update:modelValue', newValue as Value extends number ? number : Value);
  valueUnwrapped.value = newValue;

  return true;
}

function onValueCommitted(
  newValue: number | readonly number[],
  data: SliderRootCommitEventDetails,
) {
  emit('valueCommitted', newValue as Value extends number ? number : Value, data);
}

const thumbInputs = new Set<ThumbInput>();

function registerThumbInput(thumbInput: ThumbInput) {
  thumbInputs.add(thumbInput);
  return () => {
    thumbInputs.delete(thumbInput);
  };
}

// A form restore can change the inputs of several thumbs. The change of one thumb stops at the old
// value of its neighbour. It also renders the other thumbs, and Vue then writes their state over
// their restored inputs. The slider thus takes each changed input in one change.
function takeChangedInputs(valueInput: number, index: number) {
  const nextValues = values.value.slice();
  nextValues[index] = clamp(valueInput, props.min, props.max);
  const taken: ThumbInput[] = [];
  for (const thumbInput of thumbInputs) {
    const input = thumbInput.take();
    // The thumb of the event also gives its input during its own take of the hydration. A change
    // of that thumb alone still stops at its neighbours.
    if (input !== undefined && input.index !== index) {
      nextValues[input.index] = input.value;
      taken.push(thumbInput);
    }
  }
  return taken.length > 0 ? { values: nextValues.sort(asc), taken } : undefined;
}

function handleInputChange(valueInput: number, index: number, event: KeyboardEvent | Event) {
  const changedInputs = takeChangedInputs(valueInput, index);
  const newValue =
    changedInputs?.values ??
    getSliderValue(valueInput, index, props.min, props.max, range.value, values.value);

  if (validateMinimumDistance(newValue, props.step, props.minStepsBetweenValues)) {
    const reason = 'key' in event ? REASONS.keyboard : REASONS.inputChange;
    const applied = setValue(
      newValue,
      createChangeEventDetails(reason, event as KeyboardEvent, undefined, {
        activeThumbIndex: index,
      }) as SliderRootChangeEventDetails,
    );
    setTouched(true);

    if (applied) {
      onValueCommitted(
        newValue,
        createGenericEventDetails(reason, event as KeyboardEvent) as SliderRootCommitEventDetails,
      );
    }
  }

  if (changedInputs) {
    // A listener can cancel the change, and a parent that controls the slider can keep its value.
    changedInputs.taken.forEach((thumbInput) => {
      thumbInput.restoreValue();
    });
  }
}

if (process.env.NODE_ENV !== 'production') {
  watch(
    () => props.min >= props.max,
    (isEmptyRange) => {
      if (isEmptyRange) {
        warn(
          'Slider `max` must be greater than `min`.',
          'With `max` at or below `min`, the slider has no range of values to choose from.',
          'Set `max` above `min`.',
        );
      }
    },
    { immediate: true },
  );
}

watch(
  [active, isDisabled],
  () => {
    if (!isDisabled.value) {
      return;
    }

    const root = element.value;
    const activeEl = root ? activeElement(ownerDocument(root)) : null;
    // Firefox and Safari can keep focus on a disabled control.
    if (contains(root, activeEl)) {
      (activeEl as HTMLElement).blur();
    } else {
      for (const { getInput } of thumbList.map.value.values()) {
        const input = getInput();
        if (input?.matches(':focus')) {
          input.blur();
          break;
        }
      }
    }

    if (active.value !== -1) {
      setActive(-1);
    }
  },
  { flush: 'post' },
);

function resetToDefaultValue(event: Event) {
  const defaultValue = (props.defaultValue ?? props.min) as number | readonly number[];
  if (props.modelValue !== undefined || areValuesEqual(defaultValue, valueUnwrapped.value)) {
    return false;
  }

  const nextValue = (Array.isArray(defaultValue) ? defaultValue.slice() : defaultValue) as
    number | number[];
  const applied = setValue(
    nextValue,
    createChangeEventDetails(REASONS.none, event, undefined, {
      activeThumbIndex: -1,
    }) as SliderRootChangeEventDetails,
  );
  if (applied) {
    onValueCommitted(nextValue, createGenericEventDetails(REASONS.none, event));
  }
  return applied;
}

let handledReset: Event | undefined;

function reset(event: Event) {
  if (event === handledReset) {
    return;
  }
  handledReset = event;

  const previousValue = fieldValue.value;

  // `useValueChanged` sees no change when the slider clamps the default value to the current
  // value, and the field then clears here.
  if (resetToDefaultValue(event) && fieldValue.value !== previousValue) {
    isResetChangePending = true;
  } else {
    clearFieldError(fieldValue.value);
  }
}

const state = computed<SliderRootState>(() => ({
  ...fieldState.value,
  activeThumbIndex: active.value,
  disabled: isDisabled.value,
  dragging: dragging.value,
  orientation: props.orientation,
  max: props.max,
  min: props.min,
  minStepsBetweenValues: props.minStepsBetweenValues,
  step: props.step,
  values: values.value,
}));

provide(SliderRootContext, {
  active,
  controlElement,
  disabled: isDisabled,
  dragging,
  validation,
  format: computed(() => props.format),
  handleInputChange,
  registerThumbInput,
  indicatorPosition,
  setIndicatorPosition,
  inset: computed(() => props.thumbAlignment !== 'center'),
  isArrayValue: range,
  labelId,
  rootLabelId,
  registerLabelId,
  reset,
  thumbMap: thumbList.map,
  thumbList,
  largeStep: computed(() => props.largeStep),
  lastUsedThumbIndex,
  lastChangeReasonRef,
  form: computed(() => props.form),
  locale: computed(() => props.locale),
  max: computed(() => props.max),
  min: computed(() => props.min),
  minStepsBetweenValues: computed(() => props.minStepsBetweenValues),
  name: inputName,
  onValueCommitted,
  orientation: computed(() => props.orientation),
  pressedThumbCenterOffsetRef,
  pressedThumbIndexRef,
  pressedValuesRef,
  renderBeforeHydration: computed(() => props.thumbAlignment === 'edge'),
  setActive,
  setDragging(value) {
    dragging.value = value;
  },
  setValue,
  state,
  step: computed(() => props.step),
  thumbCollisionBehavior: computed(() => props.thumbCollisionBehavior),
  thumbRefs,
  values,
});

// The attributes of the consumer have no blank `aria-label` (VUE-106).
function hasAriaLabel(attrs: Record<string, unknown>) {
  return typeof attrs['aria-label'] === 'string';
}

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  props: (attrs) => [
    {
      // A server writes the attributes of the root before the `setup` of `Slider.Label`, so the
      // root assumes that label until it is mounted.
      'aria-labelledby':
        labelId.value ??
        (isHydrating.value && !hasAriaLabel(attrs) ? rootLabelId.value : undefined),
      id: rootId.value,
      role: 'group',
    },
    attrs,
    (merged) => validation.getValidationProps(isDisabled.value, merged),
  ],
  stateAttributesMapping: sliderStateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
