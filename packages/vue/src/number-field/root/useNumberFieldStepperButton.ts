import { computed } from 'vue';
import type { CSSProperties } from 'vue';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { VaseUIComponentProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { isTouchLikePointerType, usePressAndHold } from '../../internals/usePressAndHold';
import { useRenderElement } from '../../internals/useRenderElement';
import { parseNumber } from '../utils/parse';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';
import type { EventWithOptionalKeyState } from '../utils/types';
import type { NumberFieldRootState } from './NumberFieldRoot.vue';
import { useNumberFieldRootContext } from './NumberFieldRootContext';

const SELECT_NONE_STYLE: CSSProperties = {
  '-webkit-user-select': 'none',
  'user-select': 'none',
};

interface StepperButtonProps extends VaseUIComponentProps<NumberFieldRootState> {
  disabled: boolean;
  nativeButton: boolean;
}

/**
 * Shared implementation for the increment and decrement stepper buttons. They differ only in the
 * direction they step and the boundary (`max` vs `min`) at which they become disabled.
 */
export function useNumberFieldStepperButton(props: StepperButtonProps, isIncrement: boolean) {
  const {
    allowInputSyncRef,
    formatOptionsRef,
    getStepAmount,
    id,
    incrementValue,
    inputRef,
    focusInput,
    maxWithDefault,
    minWithDefault,
    setValue,
    state,
    valueRef,
    locale,
    lastChangedValueRef,
    onValueCommitted,
  } = useNumberFieldRootContext();

  const isAtBoundary = computed(() => {
    const { value } = state.value;
    return (
      value !== null &&
      (isIncrement ? value >= maxWithDefault.value : value <= minWithDefault.value)
    );
  });
  const disabled = computed(() => props.disabled || state.value.disabled || isAtBoundary.value);
  const isDisabledOrReadOnly = () => disabled.value || state.value.readOnly;

  const pressReason = isIncrement ? REASONS.incrementPress : REASONS.decrementPress;
  const direction = isIncrement ? 1 : -1;

  function commitValue(nativeEvent: MouseEvent) {
    const shouldCommitInputValue = !allowInputSyncRef.value;
    allowInputSyncRef.value = true;

    if (!shouldCommitInputValue) {
      // The input is already synced, so step from the authoritative numeric value rather than
      // re-parsing the rounded display text. Refresh the commit ref to the current value so a
      // subsequent canceled step can't commit a stale `lastChangedValueRef` left over from an
      // earlier change. The `setValue` that would refresh it is skipped on this path.
      lastChangedValueRef.value = valueRef.value;
      return;
    }

    // The input is dirty but not yet blurred, so the value won't have been committed.
    const parsedValue = parseNumber(state.value.inputValue, locale.value, formatOptionsRef.value);

    if (parsedValue !== null) {
      // Sync the dirty typed value with no direction so it isn't directionally snapped
      // (`snapOnStep`) before the real increment/decrement runs, which would otherwise emit a
      // spurious intermediate value.
      const details = createChangeEventDetails(pressReason, nativeEvent);
      setValue(parsedValue, details);

      // Only sync the ref base when the commit wasn't canceled, so a subsequent increment in the
      // same interaction steps from the value actually applied.
      if (!details.isCanceled) {
        valueRef.value = parsedValue;
      }
    }
  }

  const { pointerHandlers, shouldSkipClick } = usePressAndHold({
    disabled: isDisabledOrReadOnly,
    elementRef: inputRef,
    tick(triggerEvent) {
      const amount = getStepAmount(triggerEvent as EventWithOptionalKeyState);
      return incrementValue(amount, { direction, event: triggerEvent, reason: pressReason });
    },
    onStop(nativeEvent) {
      // `onStop` fires on every release; fall back to the current value when no tick changed it.
      // Step interactions never commit `null`, so the `??` can't mask a legitimate null commit.
      const committed = lastChangedValueRef.value ?? valueRef.value;
      onValueCommitted(committed, createGenericEventDetails(pressReason, nativeEvent));
    },
  });

  function onClick(event: MouseEvent) {
    if (event.defaultPrevented || isDisabledOrReadOnly() || shouldSkipClick(event)) {
      return;
    }

    commitValue(event);

    const amount = getStepAmount(event);

    const prev = valueRef.value;

    incrementValue(amount, { direction, event, reason: pressReason });

    const committed = lastChangedValueRef.value ?? valueRef.value;
    if (committed !== prev) {
      onValueCommitted(committed, createGenericEventDetails(pressReason, event));
    }
  }

  function onPointerdown(event: PointerEvent) {
    if (event.defaultPrevented || state.value.readOnly || event.button || disabled.value) {
      return;
    }

    // Sync dirty input value before starting the hold sequence.
    commitValue(event);
    // Treat `lastChangedValueRef` as a per-hold result slot. If the first tick is a no-op or is
    // canceled, `onStop` should fall back to the current value, not a previous interaction.
    lastChangedValueRef.value = null;

    if (!isTouchLikePointerType(event.pointerType)) {
      // Focus the input so the user can continue with keyboard interactions.
      focusInput();
    }

    pointerHandlers.onPointerdown(event);
  }

  const { getButtonProps, buttonRef } = useButton({
    // Read-only steppers are exposed as unavailable through button disabled semantics, while
    // `data-readonly` (from `state`) is preserved for styling. `aria-readonly` isn't valid on the
    // `button` role, so it's intentionally not set.
    disabled: isDisabledOrReadOnly,
    native: () => props.nativeButton,
    focusableWhenDisabled: true,
  });

  const buttonState = computed<NumberFieldRootState>(() => ({
    ...state.value,
    disabled: disabled.value,
  }));

  const { element, elementProps } = useRenderElement('button', props, {
    ref: buttonRef,
    state: buttonState,
    props: (attrs) => [
      {
        disabled: disabled.value ? '' : undefined,
        'aria-label': isIncrement ? 'Increase' : 'Decrease',
        'aria-controls': id.value,
        // Keyboard users shouldn't have access to the buttons, since they can use the input
        // element to change the value. On the other hand, `aria-hidden` is not applied because
        // touch screen readers should be able to use the buttons.
        tabindex: -1,
        style: SELECT_NONE_STYLE,
        ...pointerHandlers,
        onClick,
        onPointerdown,
      },
      attrs,
      getButtonProps,
    ],
    stateAttributesMapping,
  });

  return { element, elementProps, state: buttonState };
}
