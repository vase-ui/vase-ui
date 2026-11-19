<script lang="ts">
import type { InputHTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { OTPFieldRootState } from '../root/OTPFieldRoot.vue';

export interface OTPFieldInputState extends Omit<OTPFieldRootState, 'filled' | 'value'> {
  /**
   * Whether this input contains a character.
   */
  filled: boolean;
  /**
   * The input index.
   */
  index: number;
  /**
   * The character rendered in this slot.
   */
  value: string;
}

// The type of `autocomplete` in `InputHTMLAttributes` is a union that is too large for vue-tsc.
// With it, `defineProps` gives the error TS2590.
interface OTPFieldInputAutocomplete {
  autocomplete?: string | null | undefined;
}

export interface OTPFieldInputProps
  extends
    VaseUIComponentProps<OTPFieldInputState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<InputHTMLAttributes>, 'autocomplete'>,
    /* @vue-ignore */ OTPFieldInputAutocomplete {}
</script>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUpdated, shallowRef, useAttrs } from 'vue';
import type { ShallowRef } from 'vue';
import { useValueBeforeHydration } from '../../common/hydration';
import { ownerDocument } from '../../common/owner';
import { platform } from '../../common/platform';
import { activeElement } from '../../common/shadowDom';
import { warn } from '../../common/warn';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeList';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createVaseUIEventDetails';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { given } from '../../internals/givenAttributes';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { stopEvent } from '../../utils/popups/event';
import {
  useOTPFieldRootContext,
  normalizeOTPValueWithDetails,
  removeOTPCharacter,
  replaceOTPValue,
  inputStateAttributesMapping,
} from '../root/otpField';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<OTPFieldInputProps>(), {
  as: 'input',
});

defineSlots<{
  render: ComponentRenderFn<InputHTMLAttributes & Pick<HTMLProps, 'ref'>, OTPFieldInputState>;
}>();

const {
  activeIndex,
  characters,
  nativeMaxLength,
  focusInput,
  queueFocusInput,
  controlId,
  options,
  handleInputBlur,
  handleInputFocus,
  inputList,
  inputMode,
  inputAriaLabelledBy,
  invalid,
  pattern,
  reportValueInvalid,
  inputRender,
  setFocused,
  setValue,
  state,
} = useOTPFieldRootContext();

const direction = useDirection();

// During an IME composition, Safari gives the text through `input` events as a string that grows:
// `d`, then `dd`, then `ddd`. A commit of each value would take it as bulk input and fill too many
// slots. The slot thus buffers the text and commits it one time at `compositionend`.
const composingValue = shallowRef<string | null>(null);

// After a move in the history or a reload, the browser can restore the code of an earlier visit to
// the first slot. The slot takes nothing, so the root does not complete and submit an old code.
const writesValue = useValueBeforeHydration(props, () => element.value, { restorable: false });

const element: ShallowRef<HTMLElement | null> = shallowRef(null);
const index = useCompositeListItem(element, { list: inputList });

const slotValue = computed(() => characters.value[index.value] ?? '');
const inputState = computed<OTPFieldInputState>(() => ({
  ...state.value,
  value: slotValue.value,
  index: index.value,
  filled: slotValue.value !== '',
}));

const { valueProps, renderValue } = inputRender;

if (process.env.NODE_ENV !== 'production') {
  const attrs = useAttrs();
  let checkedIndex: number | undefined;
  let checkedLabel: unknown;

  const checkFirstSlotLabel = () => {
    const slotAriaLabel = given('aria-label', attrs['aria-label']);
    if (checkedIndex === index.value && checkedLabel === slotAriaLabel) {
      return;
    }
    checkedIndex = index.value;
    checkedLabel = slotAriaLabel;

    if (
      index.value !== 0 ||
      slotAriaLabel == null ||
      (element.value as HTMLInputElement | null)?.labels?.length
    ) {
      return;
    }

    warn(
      '<OTPField.Input> ignores `aria-label` on the first input. Use a `<label>` or `<Field.Label>` to label the OTP field.',
    );
  };

  onMounted(checkFirstSlotLabel);
  onUpdated(checkFirstSlotLabel);
}

function commitValue(
  rawValue: string,
  reason: typeof REASONS.inputChange | typeof REASONS.inputPaste,
  event: Event,
) {
  const input = event.currentTarget as HTMLInputElement;
  const [nextDigits, didRejectCharacters] = normalizeOTPValueWithDetails(
    rawValue,
    state.value.length,
    options.validationType,
    options.normalizeValue,
  );

  if (didRejectCharacters) {
    reportValueInvalid(rawValue, createGenericEventDetails(reason, event as never));
  }

  if (nextDigits === '') {
    // Typed text edits the slot in place. The slot clears, or it gets its character back when the
    // root rejects each typed character. An empty paste, or a paste that the root rejects, changes
    // nothing.
    if (reason === REASONS.inputChange) {
      if (rawValue === '') {
        setValue(
          removeOTPCharacter(state.value.value, index.value),
          createChangeEventDetails(REASONS.inputClear, event),
        );
      } else if (slotValue.value !== '') {
        // Vue writes the character back at the render, and that write clears the selection.
        renderValue();
        void nextTick(() => input.select());
      }
    }
    return;
  }

  const committedValue = setValue(
    replaceOTPValue(
      state.value.value,
      index.value,
      nextDigits,
      state.value.length,
      options.validationType,
      options.normalizeValue,
    ),
    createChangeEventDetails(reason, event as never),
  );

  // Until the hydration ends, the event can be for text that the user typed before the page was
  // ready. The focus then moves only from the slot that has it.
  if (
    committedValue != null &&
    (writesValue.value || activeElement(ownerDocument(input)) === input)
  ) {
    queueFocusInput(
      Math.min(index.value + Array.from(nextDigits).length, state.value.length - 1),
      committedValue,
    );
  }
}

function handleInput(event: Event) {
  const input = event.currentTarget as HTMLInputElement;

  if (!event.defaultPrevented && !state.value.disabled && !state.value.readOnly) {
    if (composingValue.value != null) {
      composingValue.value = input.value;
    } else {
      commitValue(input.value, REASONS.inputChange, event);
    }
  }

  // The root can refuse the text, a listener can cancel the change and the parent can keep its
  // value. The character of the slot then stays, and no render follows.
  renderValue();
}

function handleKeydown(event: KeyboardEvent) {
  // A browser gives real key names, such as `Backspace`, for keydown events in a composition. The
  // IME owns the edit until `compositionend`, so the OTP commands must not run for them.
  if (event.defaultPrevented || state.value.disabled || composingValue.value != null) {
    return;
  }

  const input = event.currentTarget as HTMLInputElement;
  const firstIndex = 0;
  const lastIndex = Math.max(state.value.length - 1, firstIndex);
  const endTargetIndex = Math.min(characters.value.length, lastIndex);
  const hasBoundaryModifier = (event.ctrlKey || event.metaKey) && !event.altKey;
  const isRtl = direction.value === 'rtl';
  const previousKey = isRtl ? 'ArrowRight' : 'ArrowLeft';
  const nextKey = isRtl ? 'ArrowLeft' : 'ArrowRight';

  if (event.key === previousKey) {
    stopEvent(event);
    focusInput(hasBoundaryModifier ? firstIndex : Math.max(firstIndex, index.value - 1));
    return;
  }

  if (event.key === nextKey) {
    stopEvent(event);
    focusInput(hasBoundaryModifier ? endTargetIndex : Math.min(lastIndex, index.value + 1));
    return;
  }

  if (event.key === 'Home' || event.key === 'ArrowUp') {
    stopEvent(event);
    focusInput(firstIndex);
    return;
  }

  if (event.key === 'End' || event.key === 'ArrowDown') {
    stopEvent(event);
    focusInput(endTargetIndex);
    return;
  }

  if (state.value.readOnly) {
    return;
  }

  function setKeyboardValue(nextValue: string, targetIndex: number) {
    const committedValue = setValue(nextValue, createChangeEventDetails(REASONS.keyboard, event));

    if (committedValue != null) {
      queueFocusInput(targetIndex, committedValue);
    }
  }

  if (event.key === 'Backspace' && hasBoundaryModifier) {
    stopEvent(event);
    setKeyboardValue('', firstIndex);
    return;
  }

  if (event.key === 'Delete') {
    stopEvent(event);
    setKeyboardValue(removeOTPCharacter(state.value.value, index.value), index.value);
    return;
  }

  const inputValue = input.value;
  const fullSelection = input.selectionStart === 0 && input.selectionEnd === inputValue.length;

  if (slotValue.value !== '' && fullSelection && slotValue.value === event.key) {
    stopEvent(event);
    if (index.value < state.value.length - 1) {
      focusInput(index.value + 1);
    }
    return;
  }

  if (event.key === 'Backspace') {
    stopEvent(event);
    const targetIndex = Math.max(firstIndex, index.value - 1);
    const deleteIndex = slotValue.value === '' ? targetIndex : index.value;
    setKeyboardValue(removeOTPCharacter(state.value.value, deleteIndex), targetIndex);
  }
}

function handlePaste(event: ClipboardEvent) {
  if (event.defaultPrevented || state.value.disabled || state.value.readOnly) {
    return;
  }

  let rawValue: string;

  try {
    rawValue = event.clipboardData?.getData('text/plain') ?? '';
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      warn('<OTPField.Input> could not read clipboard text during paste handling.');
    }

    return;
  }

  event.preventDefault();
  commitValue(rawValue, REASONS.inputPaste, event);
}

const { elementProps, setRef, usesRenderSlot } = useRenderElement('input', props, {
  elementRef: element,
  state: inputState,
  stateAttributesMapping: inputStateAttributesMapping,
  props: (attrs) => {
    // Vue before 3.5.14 sets the key `autocorrect` as a boolean DOM property, and the string `off`
    // then turns autocorrect on. Vue sets the key `autoCorrect` as an attribute in each version, and
    // a server writes it in lower case. The value of the consumer moves to that key, because two
    // keys for one attribute give two attributes on a server.
    const {
      'aria-label': externalAriaLabel,
      'aria-labelledby': externalAriaLabelledBy,
      autocorrect,
      ...elementAttrs
    } = attrs;
    const slotIndex = index.value;
    const ariaLabel = slotIndex === 0 ? undefined : (externalAriaLabel as string | undefined);
    // `null` of the consumer removes the label of the field (VUE-103).
    const inheritedLabel =
      externalAriaLabelledBy === undefined
        ? inputAriaLabelledBy.value
        : (externalAriaLabelledBy as string | null);

    return [
      {
        id:
          slotIndex === 0 || controlId.value == null
            ? controlId.value
            : `${controlId.value}-${slotIndex + 1}`,
        ...(writesValue.value ? valueProps(composingValue.value ?? slotValue.value) : undefined),
        type: options.mask ? 'password' : 'text',
        inputmode: inputMode.value,
        autocomplete: slotIndex === 0 ? options.autoComplete : 'off',
        autoCorrect: autocorrect === undefined ? 'off' : autocorrect,
        spellcheck: 'false',
        enterkeyhint: slotIndex === state.value.length - 1 ? 'done' : 'next',
        // Only the first slot has a maximum length, so that a password manager shows no bubble at a
        // later input.
        maxlength: slotIndex === 0 ? nativeMaxLength.value : undefined,
        tabindex: activeIndex.value === slotIndex ? 0 : -1,
        disabled: state.value.disabled ? '' : undefined,
        form: options.form,
        pattern: pattern.value,
        readonly: state.value.readOnly || undefined,
        required: state.value.required || undefined,
        'aria-labelledby': ariaLabel == null ? inheritedLabel : undefined,
        'aria-invalid': !state.value.disabled && invalid.value ? true : undefined,
        'aria-label': ariaLabel,
        onMousedown(event: MouseEvent) {
          if (event.defaultPrevented || state.value.disabled) {
            return;
          }

          event.preventDefault();
          focusInput(slotIndex);
        },
        onFocusin(event: FocusEvent) {
          if (event.defaultPrevented || state.value.disabled) {
            return;
          }

          setFocused(true);
          handleInputFocus(slotIndex, event);
        },
        onFocusout: handleInputBlur,
        onCompositionstart() {
          // Some Android keyboards report all text as a composition, so Android commits each
          // `input` event.
          if (!platform.os.android) {
            composingValue.value = slotValue.value;
          }
        },
        onCompositionend(event: CompositionEvent) {
          if (composingValue.value == null) {
            return;
          }

          composingValue.value = null;

          if (!state.value.disabled && !state.value.readOnly) {
            commitValue(
              (event.currentTarget as HTMLInputElement).value,
              REASONS.inputChange,
              event,
            );
          }
        },
        onInput: handleInput,
        onKeydown: handleKeydown,
        onPaste: handlePaste,
      },
      elementAttrs,
    ];
  },
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="inputState" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef" />
</template>
