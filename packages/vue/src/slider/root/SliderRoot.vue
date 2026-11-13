<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type {
  VaseUIChangeEventDetails,
  VaseUIGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
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
    /* @vue-ignore */ Omit<WithVaseUIEvent<HTMLAttributes>, 'id' | 'aria-labelledby'> {
  /**
   * The uncontrolled value of the slider when it's initially rendered.
   *
   * To render a controlled slider, use the `value` prop instead.
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
  value?: Value | undefined;
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

<script
  setup
  lang="ts"
  generic="Value extends number | readonly number[] = number | readonly number[]"
>
import { computed, provide, shallowRef, watch } from 'vue';
import { addEventListener } from '../../common/addEventListener';
import { areArraysEqual } from '../../common/areArraysEqual';
import { clamp } from '../../common/clamp';
import { useIsHydrating } from '../../common/hydration';
import { ownerDocument, ownerWindow } from '../../common/owner';
import { activeElement, contains } from '../../common/shadowDom';
import { useControlled } from '../../common/useControlled';
import { warn } from '../../common/warn';
import { useCompositeList } from '../../internals/composite/list/useCompositeList';
import type { CompositeMetadata } from '../../internals/composite/list/useCompositeList';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { useRegisterFieldControl } from '../../internals/field-register-control';
import { useClearFieldError, useFieldRootContext } from '../../internals/field-root-context';
import { useFormContext } from '../../internals/form-context';
import { createLabelIdRegistry, useControlLabelId } from '../../internals/labelable-provider';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useFormReset } from '../../internals/useFormReset';
import { useRenderElement } from '../../internals/useRenderElement';
import { useValueChanged } from '../../internals/useValueChanged';
import { asc } from '../utils/asc';
import { getSliderValue } from '../utils/getSliderValue';
import { validateMinimumDistance } from '../utils/validateMinimumDistance';
import { SliderRootContext } from './SliderRootContext';
import type { ThumbMetadata } from './SliderRootContext';
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
  value: undefined,
});

const emit = defineEmits<{
  /**
   * Callback function that is fired when the slider's value changed.
   * Receives the new value as the first argument; the originating event is
   * available as `eventDetails.event`. The value is also reflected on
   * `eventDetails.event.target.value` for form integration.
   *
   * The `eventDetails.reason` indicates what triggered the change:
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
  'update:value': [value: Value extends number ? number : Value];
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

const labelId = computed(() => props.ariaLabelledby ?? fieldLabelId.value ?? localLabelId.value);

const isDisabled = computed(() => fieldDisabled.value || props.disabled);
const inputName = computed(() => fieldName.value ?? props.name);

// The internal value is potentially unsorted, e.g. to support frozen arrays
// https://github.com/mui/material-ui/pull/28472
const [valueUnwrapped, setValueUnwrapped] = useControlled<number | readonly number[]>({
  controlled: () => props.value,
  default: () => props.defaultValue ?? props.min,
  name: 'Slider',
});

const controlElement = shallowRef<HTMLElement | null>(null);
const thumbRefs = shallowRef<Array<HTMLElement | null>>([]);
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

const thumbMap = shallowRef<ReadonlyMap<Element, CompositeMetadata<ThumbMetadata>>>(new Map());

useCompositeList<ThumbMetadata>({
  elementsRef: thumbRefs,
  onMapChange(map) {
    thumbMap.value = map;
  },
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

  // Redefine target to allow name and value to be read.
  // This allows seamless integration with the most popular form libraries.
  // https://github.com/mui/material-ui/issues/13485#issuecomment-676048492
  // Clone the event to not override `target` of the original event.
  const nativeEvent = details.event;
  const EventConstructor = nativeEvent.constructor as typeof Event;
  const clonedEvent = new EventConstructor(nativeEvent.type, nativeEvent);

  Object.defineProperty(clonedEvent, 'target', {
    writable: true,
    value: { value: newValue, name: inputName.value },
  });

  details.event = clonedEvent as typeof details.event;

  emit('valueChange', newValue as Value extends number ? number : Value, details);

  if (details.isCanceled) {
    return false;
  }

  lastChangeReasonRef.value = details.reason;

  emit('update:value', newValue as Value extends number ? number : Value);
  setValueUnwrapped(newValue);

  return true;
}

function onValueCommitted(
  newValue: number | readonly number[],
  data: SliderRootCommitEventDetails,
) {
  emit('valueCommitted', newValue as Value extends number ? number : Value, data);
}

function handleInputChange(valueInput: number, index: number, event: KeyboardEvent | Event) {
  const newValue = getSliderValue(
    valueInput,
    index,
    props.min,
    props.max,
    range.value,
    values.value,
  );

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
    if (contains(root, activeEl)) {
      // This is necessary because Firefox and Safari will keep focus
      // on a disabled element:
      // https://codesandbox.io/p/sandbox/mui-pr-22247-forked-h151h?file=/src/App.js
      (activeEl as HTMLElement).blur();
    }

    if (active.value !== -1) {
      setActive(-1);
    }
  },
  { flush: 'post' },
);

function getThumbInputs() {
  const inputs: Array<HTMLInputElement | null> = [];
  thumbRefs.value.forEach((thumb, index) => {
    inputs[index] = thumb?.querySelector<HTMLInputElement>('input[type="range"]') ?? null;
  });
  return inputs;
}

// Vue writes `value` to an input only when the value changes between two renders. Chromium restores
// the form state of a page after `load`, with no event on the input. A form would then submit a
// value that the slider does not show.
function writeValuesToInputs() {
  getThumbInputs().forEach((input, index) => {
    const value = values.value[index];
    if (input && value !== undefined && input.valueAsNumber !== value) {
      input.value = String(value);
    }
  });
}

function resetToDefaultValue(event: Event) {
  const defaultValue = (props.defaultValue ?? props.min) as number | readonly number[];
  if (props.value !== undefined || areValuesEqual(defaultValue, valueUnwrapped.value)) {
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

// Each thumb input has the same form. The reset thus follows only the first one.
const firstThumbInput = computed(() => getThumbInputs().find((input) => input != null) ?? null);

useFormReset(firstThumbInput, (event) => {
  const previousValue = fieldValue.value;

  // `useValueChanged` sees no change when the slider clamps the default value to the current
  // value, and the field then clears here.
  if (resetToDefaultValue(event) && fieldValue.value !== previousValue) {
    isResetChangePending = true;
  } else {
    clearFieldError(fieldValue.value);
  }
});

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
  indicatorPosition,
  setIndicatorPosition,
  inset: computed(() => props.thumbAlignment !== 'center'),
  isArrayValue: range,
  labelId,
  rootLabelId,
  registerLabelId,
  thumbMap,
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

function hasAriaLabel(attrs: Record<string, unknown>) {
  const ariaLabel = attrs['aria-label'];
  return typeof ariaLabel === 'string' && ariaLabel.trim() !== '';
}

const { element, elementProps } = useRenderElement('div', props, {
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

watch(
  element,
  (root, _previous, onCleanup) => {
    if (!root) {
      return;
    }

    onCleanup(addEventListener(ownerWindow(root), 'pageshow', writeValuesToInputs));
  },
  { flush: 'post' },
);

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
