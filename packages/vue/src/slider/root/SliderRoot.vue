<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type {
  VaseUIChangeEventDetails,
  VaseUIGenericEventDetails,
} from '../../internals/createVaseUIEventDetails';
import type { FieldRootState } from '../../field/types';
import { REASONS } from '../../internals/reasons';
import type { Orientation, VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { ThumbCollisionBehavior } from '../utils/thumbValues';

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
import { computed, inject, provide, shallowReactive, shallowRef, watch } from 'vue';
import { areArraysEqual } from '../../common/areArraysEqual';
import { clamp } from '../../common/clamp';
import { useIsHydrating } from '../../common/hydration';
import { ownerDocument } from '../../common/owner';
import { activeElement, contains } from '../../common/shadowDom';
import { useControlled } from '../../common/useControlled';
import { warn } from '../../common/warn';
import { useDeferredServerRender } from '../../common/deferredServerRender';
import { fieldKey } from '../../field/control';
import { useFieldGroup } from '../../field/group';
import { useInDisabledFieldset } from '../../fieldset/part';
import { useCompositeList } from '../../internals/composite/list/useCompositeList';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createVaseUIEventDetails';
import { DEFAULT_FIELD_STATE_ATTRIBUTES } from '../../internals/field-constants';
import { given } from '../../internals/givenAttributes';
import { createLabelIdRegistry } from '../../internals/labelable-provider';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { useValueChanged } from '../../internals/useValueChanged';
import { asc, getSliderValue, validateMinimumDistance } from '../utils/thumbValues';
import { SliderRootContext, sliderStateAttributesMapping } from './SliderRootContext';
import type { ThumbInput, ThumbMetadata } from './SliderRootContext';

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
   * - `'input-change'` for an `input` event on a thumb
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
   * Reports an accepted value and the event that completed the interaction.
   * For a pointer or touch press, the reason comes from its last accepted change.
   * Disabling or replacing the control discards the pending commit. A release also discards a
   * proposal if the model type or the number of thumbs has changed.
   * Keyboard and native input edits keep their own reason. A form reset uses `'none'`.
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

function areValuesEqual(newValue: unknown, oldValue: unknown) {
  return (
    newValue === oldValue ||
    (Array.isArray(newValue) && Array.isArray(oldValue) && areArraysEqual(newValue, oldValue))
  );
}

const rootId = useVaseUiId(() => props.id);
const rootLabelId = computed(() => `${rootId.value}-label`);

const field = inject(fieldKey, null);
// In a field, the root defers its server render. The label of the field can come after the root.
if (field) useDeferredServerRender();
const { labelId: localLabelId, registerLabelId } = createLabelIdRegistry();
const isHydrating = useIsHydrating();

const labelId = computed(
  () => given('aria-labelledby', props.ariaLabelledby) ?? field?.labelId ?? localLabelId.value,
);

const fieldsetDisabled = useInDisabledFieldset(() => element.value);
const isDisabled = computed(() => !!field?.disabled || fieldsetDisabled.value || props.disabled);

const valueUnwrapped = useControlled<number | readonly number[]>({
  controlled: () => props.modelValue,
  default: () => props.defaultValue ?? props.min,
  name: 'Slider',
});

const controlElement = shallowRef<HTMLElement | null>(null);
const thumbRefs = shallowRef<(HTMLElement | null)[]>([]);
const active = shallowRef(-1);
const lastUsedThumbIndex = shallowRef(-1);
const dragging = shallowRef(false);
const indicatorPosition = shallowReactive<[number | undefined, number | undefined]>([
  undefined,
  undefined,
]);

function setActive(value: number) {
  active.value = value;

  if (value !== -1) {
    lastUsedThumbIndex.value = value;
  }
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

const inputName = computed(() => field?.name ?? props.name);
watch(fieldValue, (value) => field?.setValue(value, false), { immediate: true });

// The change of a reset reaches `useValueChanged` after the reset timeout. A clear in the timeout
// would come before `validation.change`, and the validation could show a new error. The timeout sets
// this flag, and the callback clears the field and starts no validation.
let isResetChangePending = false;

useValueChanged(fieldValue, () => {
  if (isResetChangePending) {
    isResetChangePending = false;
    field?.onReset(fieldValue.value);
  } else {
    field?.onEdit();
  }
});

function setValue(
  newValue: number | number[],
  index: number,
  reason: SliderRootChangeEventReason,
  event?: Event,
) {
  if (Number.isNaN(newValue) || areValuesEqual(newValue, valueUnwrapped.value)) {
    return false;
  }

  const details = createChangeEventDetails(reason, event, undefined, { activeThumbIndex: index });
  emit('valueChange', newValue as Value extends number ? number : Value, details);

  if (details.isCanceled) {
    return false;
  }

  emit('update:modelValue', newValue as Value extends number ? number : Value);
  valueUnwrapped.value = newValue;

  return true;
}

function commitValue(
  newValue: number | readonly number[],
  reason: SliderRootCommitEventReason,
  event: Event,
) {
  emit(
    'valueCommitted',
    newValue as Value extends number ? number : Value,
    createGenericEventDetails(reason, event),
  );
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

function handleInputChange(valueInput: number, index: number, event: Event) {
  const changedInputs = takeChangedInputs(valueInput, index);
  const newValue =
    changedInputs?.values ??
    getSliderValue(valueInput, index, props.min, props.max, range.value, values.value);

  if (validateMinimumDistance(newValue, props.step, props.minStepsBetweenValues)) {
    const reason = 'key' in event ? REASONS.keyboard : REASONS.inputChange;
    const applied = setValue(newValue, index, reason, event);

    if (applied) {
      commitValue(newValue, reason, event);
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
  if (props.modelValue !== undefined) return false;
  const initial = props.defaultValue ?? props.min;
  const nextValue = typeof initial === 'number' ? initial : initial.slice();
  const applied = setValue(nextValue, -1, REASONS.none, event);
  if (applied) {
    commitValue(nextValue, REASONS.none, event);
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
    field?.onReset(fieldValue.value);
  }
}

const state = computed<SliderRootState>(() => ({
  ...(field?.state ?? DEFAULT_FIELD_STATE_ATTRIBUTES),
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
  props,
  controlElement,
  setControlElement(next, previous) {
    if (next || controlElement.value === previous) controlElement.value = next;
  },
  disabled: isDisabled,
  field,
  onLeave: (left) => field?.onLeave(left),
  handleInputChange,
  registerThumbInput,
  indicatorPosition,
  setIndicatorPosition(edge, position) {
    indicatorPosition[edge] = position;
  },
  inset: computed(() => props.thumbAlignment !== 'center'),
  isArrayValue: range,
  labelId,
  rootLabelId,
  registerLabelId,
  reset,
  thumbList,
  lastUsedThumbIndex,
  name: inputName,
  commitValue,
  renderBeforeHydration: computed(() => props.thumbAlignment === 'edge'),
  setActive,
  setDragging(value) {
    dragging.value = value;
  },
  setValue,
  state,
  thumbRefs,
  values,
});

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  props: (attrs) => [
    {
      // A server writes the attributes of the root before the `setup` of `Slider.Label`, so the
      // root assumes that label until it is mounted.
      'aria-labelledby':
        labelId.value ??
        (isHydrating.value && typeof attrs['aria-label'] !== 'string'
          ? rootLabelId.value
          : undefined),
      'aria-describedby': field?.describedBy,
      id: rootId.value,
      role: 'group',
    },
    attrs,
  ],
  stateAttributesMapping: sliderStateAttributesMapping,
});

// The root is the control of the field, and the range inputs hold the value for the validation.
const thumbInputElements = () =>
  [...thumbList.map.value.values()]
    .map((thumb) => thumb.getInput())
    .filter((input) => input !== null);
useFieldGroup({
  element,
  disabled: () => isDisabled.value,
  ownDisabled: () => props.disabled || fieldsetDisabled.value,
  readOnly: () => false,
  name: () => props.name,
  inputs: thumbInputElements,
  focusElement: () => thumbInputElements()[0],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
