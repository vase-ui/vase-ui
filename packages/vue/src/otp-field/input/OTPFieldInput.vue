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
  autocomplete?: string | undefined;
}

export interface OTPFieldInputProps
  extends
    VaseUIComponentProps<OTPFieldInputState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<InputHTMLAttributes>, 'autocomplete'>,
    /* @vue-ignore */ OTPFieldInputAutocomplete {}
</script>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUpdated, shallowRef, useAttrs, watch } from 'vue';
import { platform } from '../../common/platform';
import { warn } from '../../common/warn';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { useSetFieldFocused } from '../../internals/field-root-context/useSetFieldFocused';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { stopEvent } from '../../utils/popups/event';
import { getOTPFieldInputState, useOTPFieldRootContext } from '../root/OTPFieldRootContext';
import { normalizeOTPValueWithDetails, removeOTPCharacter, replaceOTPValue } from '../utils/otp';
import { inputStateAttributesMapping } from '../utils/stateAttributesMapping';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<OTPFieldInputProps>(), {
  as: 'input',
});

defineSlots<{
  render: ComponentRenderFn<InputHTMLAttributes & Pick<HTMLProps, 'ref'>, OTPFieldInputState>;
}>();

const {
  activeIndex,
  autoComplete,
  disabled,
  form,
  focusInput,
  queueFocusInput,
  getInputId,
  handleInputBlur,
  handleInputFocus,
  inputMode,
  inputAriaLabelledBy,
  invalid,
  length,
  mask,
  pattern,
  reportValueInvalid,
  readOnly,
  required,
  normalizeValue,
  setFocused: setRootFocused,
  setValue,
  state,
  validationType,
  value,
} = useOTPFieldRootContext();

const { ref: listItemRef, index } = useCompositeListItem();
const setFocused = useSetFieldFocused(disabled, () => element.value, setRootFocused);
const direction = useDirection();

// During an IME composition, Safari gives the text through `input` events as a string that grows:
// `d`, then `dd`, then `ddd`. A commit of each value would take it as bulk input and fill too many
// slots. The slot thus buffers the text and commits it one time at `compositionend`.
const composingValue = shallowRef<string | null>(null);

const slotValue = computed(() => value.value[index.value] ?? '');
const inputState = computed(() => getOTPFieldInputState(state.value, slotValue.value, index.value));

// The value that the input had after the last event that the part handled, and after the last
// write of the part or of Vue. A `change` event for that value is not new.
let handledValue: string | undefined;

// Vue writes `value` to the input only when the part renders. The part does not render when the
// character of its slot stays the same: the root refused the text, a listener canceled the change,
// or the parent kept its value. The input then keeps the text that the user typed.
function writeSlotValueToInput() {
  const input = element.value as HTMLInputElement | null;
  if (!input) {
    return;
  }
  const expectedValue = composingValue.value ?? slotValue.value;
  if (input.value !== expectedValue) {
    input.value = expectedValue;
  }
  handledValue = input.value;
}

if (process.env.NODE_ENV !== 'production') {
  const attrs = useAttrs();
  let checkedIndex: number | undefined;
  let checkedLabel: unknown;

  const checkFirstSlotLabel = () => {
    const slotAriaLabel = attrs['aria-label'];
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
    length.value,
    validationType.value,
    normalizeValue.value,
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
          removeOTPCharacter(value.value, index.value),
          createChangeEventDetails(REASONS.inputClear, event),
        );
      } else if (slotValue.value !== '') {
        input.value = slotValue.value;
        input.select();
      }
    }
    return;
  }

  const committedValue = setValue(
    replaceOTPValue(
      value.value,
      index.value,
      nextDigits,
      length.value,
      validationType.value,
      normalizeValue.value,
    ),
    createChangeEventDetails(reason, event as never),
  );

  if (committedValue != null) {
    queueFocusInput(Math.min(index.value + nextDigits.length, length.value - 1), committedValue);
  }
}

function handleInput(event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  handledValue = input.value;

  if (!disabled.value && !readOnly.value) {
    if (composingValue.value != null) {
      composingValue.value = input.value;
    } else {
      commitValue(input.value, REASONS.inputChange, event);
    }
  }

  // The wait starts after the change, so that it ends after the flush of a parent that takes the
  // character. A write before that flush would put the old character in the input.
  void nextTick(writeSlotValueToInput);
}

// Some programs that fill a form send only `change`.
function handleChange(event: Event) {
  if ((event.currentTarget as HTMLInputElement).value !== handledValue) {
    handleInput(event);
  }
}

function handleKeydown(event: KeyboardEvent) {
  // A browser gives real key names, such as `Backspace`, for keydown events in a composition. The
  // IME owns the edit until `compositionend`, so the OTP commands must not run for them.
  if (event.defaultPrevented || disabled.value || composingValue.value != null) {
    return;
  }

  const input = event.currentTarget as HTMLInputElement;
  const firstIndex = 0;
  const lastIndex = Math.max(length.value - 1, firstIndex);
  const endTargetIndex = Math.min(value.value.length, lastIndex);
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

  if (readOnly.value) {
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
    setKeyboardValue(removeOTPCharacter(value.value, index.value), index.value);
    return;
  }

  const inputValue = input.value;
  const fullSelection = input.selectionStart === 0 && input.selectionEnd === inputValue.length;

  if (event.key.length === 1 && fullSelection && slotValue.value === event.key) {
    stopEvent(event);
    if (index.value < length.value - 1) {
      focusInput(index.value + 1);
    }
    return;
  }

  if (event.key === 'Backspace') {
    stopEvent(event);
    const targetIndex = Math.max(firstIndex, index.value - 1);
    const deleteIndex = slotValue.value === '' ? targetIndex : index.value;
    setKeyboardValue(removeOTPCharacter(value.value, deleteIndex), targetIndex);
  }
}

function handlePaste(event: ClipboardEvent) {
  if (event.defaultPrevented || disabled.value || readOnly.value) {
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

const { element, elementProps } = useRenderElement('input', props, {
  state: inputState,
  ref: [listItemRef],
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
    const inheritedLabel =
      (externalAriaLabelledBy as string | undefined) ?? inputAriaLabelledBy.value;

    return [
      {
        id: getInputId(slotIndex),
        value: composingValue.value ?? slotValue.value,
        type: mask.value ? 'password' : 'text',
        inputmode: inputMode.value,
        autocomplete: slotIndex === 0 ? autoComplete.value : 'off',
        autoCorrect: autocorrect === undefined ? 'off' : autocorrect,
        spellcheck: 'false',
        enterkeyhint: slotIndex === length.value - 1 ? 'done' : 'next',
        // Only the first slot has a maximum length, so that a password manager shows no bubble at a
        // later input.
        maxlength: slotIndex === 0 ? length.value : undefined,
        tabindex: activeIndex.value === slotIndex ? 0 : -1,
        disabled: disabled.value ? '' : undefined,
        form: form.value,
        pattern: pattern.value,
        readonly: readOnly.value || undefined,
        required: required.value || undefined,
        'aria-labelledby': ariaLabel == null ? inheritedLabel : undefined,
        'aria-invalid': !disabled.value && invalid.value ? true : undefined,
        'aria-label': ariaLabel,
        onMousedown(event: MouseEvent) {
          if (event.defaultPrevented || disabled.value) {
            return;
          }

          event.preventDefault();
          focusInput(slotIndex);
        },
        onFocusin(event: FocusEvent) {
          if (disabled.value) {
            return;
          }

          setFocused(true);
          handleInputFocus(slotIndex, event);
        },
        onFocusout(event: FocusEvent) {
          // Focus that moves to a sibling slot stays inside the root. `handleInputBlur` clears the
          // focused state only when focus leaves the root, so a move between slots does not change it.
          handleInputBlur(event);
        },
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

          if (!disabled.value && !readOnly.value) {
            commitValue(
              (event.currentTarget as HTMLInputElement).value,
              REASONS.inputChange,
              event,
            );
          }
        },
        onInput: handleInput,
        onChange: handleChange,
        onKeydown: handleKeydown,
        onPaste: handlePaste,
      },
      elementAttrs,
    ];
  },
});

// Vue writes the value to the input when the character of the slot changes. A program can then send
// a `change` event with the value that the input had before, and the part must handle it.
watch(
  [slotValue, composingValue],
  () => {
    handledValue = (element.value as HTMLInputElement | null)?.value;
  },
  { flush: 'post' },
);

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="inputState" />
  <component :is="as" v-else v-bind="elementProps()" />
</template>
