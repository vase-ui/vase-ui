import { inject } from 'vue';
import type { ComputedRef, InjectionKey, Ref, ShallowRef } from 'vue';
import type { CompositeMetadata } from '../../internals/composite/list/useCompositeList';
import type { UseFieldValidationReturnValue } from '../../internals/field-root-context/FieldRootContext';
import type { RegisterId } from '../../internals/labelable-provider/LabelableContext';
import type { Orientation } from '../../internals/types';
import type { ThumbCollisionBehavior } from '../utils/resolveThumbCollision';
import type {
  SliderRootChangeEventDetails,
  SliderRootChangeEventReason,
  SliderRootCommitEventDetails,
  SliderRootState,
} from './SliderRoot.vue';

export interface ThumbMetadata {
  inputId: string | undefined;
}

export interface SliderRootContext {
  /**
   * The index of the active thumb.
   */
  active: Readonly<Ref<number>>;
  /**
   * The index of the most recently interacted thumb.
   */
  lastUsedThumbIndex: Readonly<Ref<number>>;
  controlElement: ShallowRef<HTMLElement | null>;
  dragging: Readonly<Ref<boolean>>;
  disabled: ComputedRef<boolean>;
  validation: UseFieldValidationReturnValue;
  /**
   * Options to format the value.
   */
  format: ComputedRef<Intl.NumberFormatOptions | undefined>;
  handleInputChange: (valueInput: number, index: number, event: KeyboardEvent | Event) => void;
  /**
   * The positions of the first thumb and of the last thumb of an inset slider, as percentages.
   */
  indicatorPosition: Readonly<Ref<readonly [number | undefined, number | undefined]>>;
  setIndicatorPosition: (edge: 0 | 1, position: number | undefined) => void;
  inset: ComputedRef<boolean>;
  /**
   * Whether the slider value is an array, including single-thumb arrays.
   */
  isArrayValue: ComputedRef<boolean>;
  /**
   * The `aria-labelledby` of each thumb that has no name of its own.
   */
  labelId: ComputedRef<string | undefined>;
  /**
   * The `id` of `Slider.Label`.
   */
  rootLabelId: ComputedRef<string>;
  registerLabelId: RegisterId;
  thumbMap: Readonly<Ref<ReadonlyMap<Element, CompositeMetadata<ThumbMetadata>>>>;
  largeStep: ComputedRef<number>;
  lastChangeReasonRef: Ref<SliderRootChangeEventReason>;
  locale: ComputedRef<Intl.LocalesArgument | undefined>;
  max: ComputedRef<number>;
  min: ComputedRef<number>;
  minStepsBetweenValues: ComputedRef<number>;
  form: ComputedRef<string | undefined>;
  name: ComputedRef<string | undefined>;
  /**
   * Function to be called when drag ends and the pointer is released.
   */
  onValueCommitted: (
    newValue: number | readonly number[],
    data: SliderRootCommitEventDetails,
  ) => void;
  orientation: ComputedRef<Orientation>;
  pressedThumbCenterOffsetRef: Ref<number | null>;
  pressedThumbIndexRef: Ref<number>;
  pressedValuesRef: Ref<readonly number[] | null>;
  renderBeforeHydration: ComputedRef<boolean>;
  setActive: (index: number) => void;
  setDragging: (dragging: boolean) => void;
  /**
   * Applies a new value through `valueChange` for keyboard, input, track-press,
   * and drag interactions. Returns `true` when the value was applied, or `false`
   * when it was invalid (NaN), unchanged, or the change was canceled.
   */
  setValue: (newValue: number | number[], details: SliderRootChangeEventDetails) => boolean;
  state: ComputedRef<SliderRootState>;
  step: ComputedRef<number>;
  thumbCollisionBehavior: ComputedRef<ThumbCollisionBehavior>;
  thumbRefs: ShallowRef<(HTMLElement | null)[]>;
  /**
   * The value(s) of the slider
   */
  values: ComputedRef<readonly number[]>;
}

export const SliderRootContext: InjectionKey<SliderRootContext> = Symbol();

export function useSliderRootContext(): SliderRootContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(SliderRootContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of Slider must be inside <Slider.Root>. Without a root the part has no value to show or to change. Put the part inside <Slider.Root>.',
    );
  }
  return context;
}
