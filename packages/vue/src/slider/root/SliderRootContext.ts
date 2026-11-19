import { inject } from 'vue';
import type { ComputedRef, InjectionKey, Ref } from 'vue';
import type { CompositeListContextValue } from '../../internals/composite/list/useCompositeList';
import type { UseFieldValidationReturnValue } from '../../internals/field-root-context/FieldRootContext';
import type { RegisterId } from '../../internals/labelable-provider/LabelableContext';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { ThumbCollisionBehavior } from '../utils/thumbValues';
import type {
  SliderRootProps,
  SliderRootChangeEventReason,
  SliderRootCommitEventReason,
  SliderRootState,
} from './SliderRoot.vue';

export interface ThumbMetadata {
  inputId: string | undefined;
  getInput: () => HTMLInputElement | null;
}

/** The range input of a thumb, for a change that takes the inputs of several thumbs. */
export interface ThumbInput {
  /** Read a native edit that the slider has yet to receive. */
  take: () => { index: number; value: number } | undefined;
  restoreValue: () => void;
}

export interface SliderRootContext {
  props: Readonly<
    Pick<SliderRootProps, 'format' | 'form' | 'locale'> &
      Pick<SliderRootState, 'max' | 'min' | 'minStepsBetweenValues' | 'orientation' | 'step'> & {
        largeStep: number;
        thumbCollisionBehavior: ThumbCollisionBehavior;
      }
  >;
  state: ComputedRef<SliderRootState>;
  disabled: ComputedRef<boolean>;
  lastUsedThumbIndex: Readonly<Ref<number>>;
  controlElement: Readonly<Ref<HTMLElement | null>>;
  setControlElement: (element: HTMLElement | null, previous: HTMLElement | null) => void;
  validation: UseFieldValidationReturnValue;
  handleInputChange: (value: number, index: number, event: Event) => void;
  registerThumbInput: (input: ThumbInput) => () => void;
  indicatorPosition: readonly [number | undefined, number | undefined];
  setIndicatorPosition: (edge: 0 | 1, position: number | undefined) => void;
  inset: ComputedRef<boolean>;
  isArrayValue: ComputedRef<boolean>;
  labelId: ComputedRef<string | undefined>;
  rootLabelId: ComputedRef<string>;
  registerLabelId: RegisterId;
  reset: (event: Event) => void;
  thumbList: CompositeListContextValue<ThumbMetadata>;
  name: ComputedRef<string | undefined>;
  commitValue: (
    value: number | readonly number[],
    reason: SliderRootCommitEventReason,
    event: Event,
  ) => void;
  pressedThumb: Readonly<{ index: number; centerOffset: number | null }>;
  setPressedThumb: (index: number, centerOffset: number | null) => void;
  renderBeforeHydration: ComputedRef<boolean>;
  setActive: (index: number) => void;
  setDragging: (dragging: boolean) => void;
  setValue: (
    value: number | number[],
    index: number,
    reason: SliderRootChangeEventReason,
    event?: Event,
  ) => boolean;
  thumbRefs: Readonly<Ref<readonly (HTMLElement | null)[]>>;
  values: ComputedRef<readonly number[]>;
}

export const SliderRootContext: InjectionKey<SliderRootContext> = Symbol();

export function useSliderRootContext(): SliderRootContext {
  const context = inject(SliderRootContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of Slider must be inside <Slider.Root>. Without a root the part has no value to show or to change. Put the part inside <Slider.Root>.',
    );
  }
  return context;
}

const nullMapping = () => null;

export const sliderStateAttributesMapping: StateAttributesMapping<SliderRootState> = {
  activeThumbIndex: nullMapping,
  max: nullMapping,
  min: nullMapping,
  minStepsBetweenValues: nullMapping,
  step: nullMapping,
  values: nullMapping,
  ...fieldValidityMapping,
};

export interface SliderThumbContext {
  inputProps: () => Record<string, any>;
  setInputElement: (value: unknown) => void;
  hasPrehydrationScript: ComputedRef<boolean>;
}

export const SliderThumbContext: InjectionKey<SliderThumbContext> = Symbol();

export function useSliderThumbContext(): SliderThumbContext {
  const context = inject(SliderThumbContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: The `children` component of <Slider.Thumb> must be inside <Slider.Thumb>. Without the part it has no input to render. Mount the `children` component in the element of the `#render` slot of <Slider.Thumb>.',
    );
  }

  return context;
}
