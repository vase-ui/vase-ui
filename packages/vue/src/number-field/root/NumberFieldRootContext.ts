import { computed, inject } from 'vue';
import type { ComputedRef, CSSProperties, InjectionKey, Ref, ShallowRef } from 'vue';
import { useFieldsetDisabled } from '../../fieldset/root/useFieldsetDisabled';
import { createGenericEventDetails } from '../../internals/createVaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { VaseUIComponentProps } from '../../internals/types';
import { useButton } from '../../internals/use-button/useButton';
import { isTouchLikePointerType, usePressAndHold } from '../../internals/usePressAndHold';
import { useRenderElement } from '../../internals/useRenderElement';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { EventWithOptionalKeyState, IncrementValueParameters } from '../utils/parse';
import type {
  NumberFieldRootChangeEventDetails,
  NumberFieldRootCommitEventDetails,
  NumberFieldRootProps,
  NumberFieldRootState,
} from './NumberFieldRoot.vue';

export interface NumberFieldRootContext {
  minWithDefault: ComputedRef<number>;
  maxWithDefault: ComputedRef<number>;
  id: ComputedRef<string>;
  /** A stepper names the server ID until mount, then the ID of the current input. */
  inputId: ComputedRef<string | undefined>;
  setValue: (value: number | null, details: NumberFieldRootChangeEventDetails) => boolean;
  getStepAmount: (event?: EventWithOptionalKeyState) => number;
  incrementValue: (amount: number, params: IncrementValueParameters) => boolean;
  inputRef: Readonly<ShallowRef<HTMLInputElement | null>>;
  registerInput: (input: HTMLInputElement) => () => void;
  options: Readonly<
    Pick<
      NumberFieldRootProps,
      'allowOutOfRange' | 'format' | 'form' | 'name' | 'min' | 'max' | 'readOnly'
    >
  >;
  setEditing: (editing: boolean) => boolean;
  prepareStep: () => boolean;
  prepareStepper: (
    event: MouseEvent,
    reason: typeof REASONS.incrementPress | typeof REASONS.decrementPress,
    hold?: boolean,
  ) => number | null;
  getStepCommitValue: () => number | null;
  focusInput: () => void;
  lastChangedValueRef: Readonly<Ref<number | null>>;
  hasPendingCommitRef: Readonly<Ref<boolean>>;
  name: ComputedRef<string | undefined>;
  value: ComputedRef<number | null>;
  disabled: ComputedRef<boolean>;
  setInputValue: (inputValue: string) => void;
  locale: ComputedRef<Intl.LocalesArgument | undefined>;
  setIsScrubbing: (scrubbing: boolean) => void;
  state: ComputedRef<NumberFieldRootState>;
  onValueCommitted: (value: number | null, eventDetails: NumberFieldRootCommitEventDetails) => void;
  /**
   * The handler of the `wheel` event of the text input. The input binds it as `onWheel` while
   * `isWheelScrubEnabled` is `true`.
   */
  onInputWheel: (event: WheelEvent) => void;
  isWheelScrubEnabled: ComputedRef<boolean>;
  /**
   * `true` while a native reset of the form changes the value. The root clears the error of the
   * field for that change, so the input must not validate the value of a reset.
   */
  isResetChangePending: Readonly<Ref<boolean>>;
}

export const NumberFieldRootContext: InjectionKey<NumberFieldRootContext> = Symbol();

export function useNumberFieldRootContext(): NumberFieldRootContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(NumberFieldRootContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of Number Field must be inside <NumberField.Root>. Without a root the part has no value to show. Put the part inside <NumberField.Root>.',
    );
  }

  return context;
}

export const stateAttributesMapping: StateAttributesMapping<NumberFieldRootState> = {
  inputValue: () => null,
  value: () => null,
  ...fieldValidityMapping,
};

export interface ScrubCursor {
  element: HTMLSpanElement;
  place: (x: number, y: number) => void;
}

export interface NumberFieldScrubAreaContext {
  isScrubbing: Readonly<Ref<boolean>>;
  isTouchInput: Readonly<Ref<boolean>>;
  isPointerLockDenied: Readonly<Ref<boolean>>;
  setCursor: (element: HTMLSpanElement | null, place: ScrubCursor['place']) => void;
  /**
   * The element of the scrub area. `NumberField.ScrubAreaCursor` renders in its root node.
   */
  scrubAreaElement: Readonly<ShallowRef<HTMLElement | null>>;
}

export const NumberFieldScrubAreaContext: InjectionKey<NumberFieldScrubAreaContext> = Symbol();

export function useNumberFieldScrubAreaContext(): NumberFieldScrubAreaContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(NumberFieldScrubAreaContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of the scrub area of Number Field must be inside <NumberField.ScrubArea>. Without a scrub area the part has no scrub to follow. Put the part inside <NumberField.ScrubArea>.',
    );
  }
  return context;
}

const SELECT_NONE_STYLE: CSSProperties = {
  '-webkit-user-select': 'none',
  'user-select': 'none',
};

interface StepperButtonProps extends VaseUIComponentProps<NumberFieldRootState> {
  disabled: boolean;
  nativeButton: boolean;
}

export function useNumberFieldStepperButton(props: StepperButtonProps, isIncrement: boolean) {
  const {
    prepareStepper,
    getStepCommitValue,
    getStepAmount,
    inputId,
    incrementValue,
    inputRef,
    focusInput,
    maxWithDefault,
    minWithDefault,
    state,
    onValueCommitted,
  } = useNumberFieldRootContext();

  const isAtBoundary = computed(() => {
    const { value } = state.value;
    return (
      value !== null &&
      (isIncrement ? value >= maxWithDefault.value : value <= minWithDefault.value)
    );
  });
  const fieldsetDisabled = useFieldsetDisabled(() => element.value);
  const disabled = computed(
    () => props.disabled || state.value.disabled || fieldsetDisabled.value || isAtBoundary.value,
  );
  const isDisabledOrReadOnly = () => disabled.value || state.value.readOnly;

  const pressReason = isIncrement ? REASONS.incrementPress : REASONS.decrementPress;
  const direction = isIncrement ? 1 : -1;

  const { pointerHandlers, shouldSkipClick } = usePressAndHold({
    disabled: isDisabledOrReadOnly,
    elementRef: inputRef,
    tick(triggerEvent) {
      const amount = getStepAmount(triggerEvent as EventWithOptionalKeyState);
      return incrementValue(amount, { direction, event: triggerEvent, reason: pressReason });
    },
    onStop(nativeEvent) {
      onValueCommitted(getStepCommitValue(), createGenericEventDetails(pressReason, nativeEvent));
    },
  });

  function onClick(event: MouseEvent) {
    if (event.defaultPrevented || isDisabledOrReadOnly() || shouldSkipClick(event)) {
      return;
    }

    const prev = prepareStepper(event, pressReason);
    const amount = getStepAmount(event);
    incrementValue(amount, { direction, event, reason: pressReason });

    const committed = getStepCommitValue();
    if (committed !== prev) {
      onValueCommitted(committed, createGenericEventDetails(pressReason, event));
    }
  }

  function onPointerdown(event: PointerEvent) {
    if (event.defaultPrevented || state.value.readOnly || event.button || disabled.value) {
      return;
    }

    prepareStepper(event, pressReason, true);

    if (!isTouchLikePointerType(event.pointerType)) {
      // Focus the input so the user can continue with keyboard interactions.
      focusInput();
    }

    pointerHandlers.onPointerdown(event);
  }

  const buttonState = computed<NumberFieldRootState>(() => ({
    ...state.value,
    disabled: disabled.value,
  }));

  const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('button', props, {
    button: (element) =>
      useButton(element, {
        // The button role has no read-only state.
        disabled: isDisabledOrReadOnly,
        native: () => props.nativeButton,
        focusableWhenDisabled: true,
      }),
    state: buttonState,
    props: (attrs) => [
      {
        disabled: disabled.value ? '' : undefined,
        'aria-label': isIncrement ? 'Increase' : 'Decrease',
        'aria-controls': inputId.value,
        // Keyboard users step in the input. Touch screen readers need both buttons.
        tabindex: -1,
        style: SELECT_NONE_STYLE,
        ...pointerHandlers,
        onClick,
        onPointerdown,
      },
      attrs,
    ],
    stateAttributesMapping,
  });

  return { element, elementProps, setRef, usesRenderSlot, state: buttonState };
}
