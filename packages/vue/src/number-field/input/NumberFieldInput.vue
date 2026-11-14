<script lang="ts">
import type { InputHTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { NumberFieldRootState } from '../root/NumberFieldRoot.vue';

export interface NumberFieldInputState extends NumberFieldRootState {}

// The type of `autocomplete` in `InputHTMLAttributes` is a union that is too large for vue-tsc.
// With it, `defineProps` gives the error TS2590.
interface NumberFieldInputAutocomplete {
  autocomplete?: string | undefined;
}

export interface NumberFieldInputProps
  extends
    VaseUIComponentProps<NumberFieldInputState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<InputHTMLAttributes>, 'autocomplete'>,
    /* @vue-ignore */ NumberFieldInputAutocomplete {}
</script>

<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { formatNumber } from '../../common/formatNumber';
import { useTimeout } from '../../common/useTimeout';
import { warn } from '../../common/warn';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { useRegisterFieldControl } from '../../internals/field-register-control';
import { useFieldRootContext } from '../../internals/field-root-context';
import { useSetFieldFocused } from '../../internals/field-root-context/useSetFieldFocused';
import { useFormContext } from '../../internals/form-context';
import { useDeferredServerRender, useLabelableContext } from '../../internals/labelable-provider';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useValueChanged } from '../../internals/useValueChanged';
import { useNumberFieldRootContext } from '../root/NumberFieldRootContext';
import {
  ANY_MINUS_DETECT_RE,
  ANY_MINUS_RE,
  ANY_PLUS_DETECT_RE,
  ANY_PLUS_RE,
  FORMAT_CONTROL_DETECT_RE,
  getNumberLocaleDetails,
  isNumeralChar,
  parseNumber,
} from '../utils/parse';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';
import { hasNumberFormatRoundingOptions, removeFloatingPointErrors } from '../utils/validate';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NumberFieldInputProps>(), { as: 'input' });

defineSlots<{
  render: ComponentRenderFn<InputHTMLAttributes & Pick<HTMLProps, 'ref'>, NumberFieldInputState>;
}>();

const NAVIGATE_KEYS = new Set([
  'Backspace',
  'Delete',
  'ArrowLeft',
  'ArrowRight',
  'Tab',
  'Enter',
  'Escape',
]);

const {
  allowInputSyncRef,
  formatOptionsRef,
  getAllowedNonNumericKeys,
  getStepAmount,
  id,
  form,
  incrementValue,
  inputMode,
  max,
  min,
  name,
  nameProp,
  setValue,
  state,
  value: numberValue,
  disabled: isDisabled,
  setInputValue,
  locale,
  inputRef,
  onValueCommitted,
  lastChangedValueRef,
  hasPendingCommitRef,
  valueRef,
  onInputWheel,
  isWheelScrubEnabled,
  isResetChangePending,
} = useNumberFieldRootContext();

const { clearErrors } = useFormContext();
const { validationMode, setTouched, invalid, shouldValidateOnChange, validation } =
  useFieldRootContext();
const { labelId } = useLabelableContext();

// The input binds `aria-labelledby` and `aria-describedby`, and a label or a message can come after
// it.
useDeferredServerRender();

const setFocused = useSetFieldFocused(() => state.value.disabled, inputRef);

let blockRevalidation = false;
let pendingCaret: number | null = null;

useRegisterFieldControl(
  inputRef,
  id,
  () => numberValue.value,
  undefined,
  () => !isDisabled.value,
  nameProp,
);

// The text that the input has after the last event that the part handled. A write of Vue or of
// the part sets it too.
let handledText: string | undefined;

// Vue writes the text of the state to the input only when the part renders. React writes it after
// each event, so a change that the part refuses leaves the input as it was. The part writes the
// text itself where no render follows. After a paste it also moves the caret behind the pasted
// text, which the browser would put at the end of the new text.
function writeTextToInput() {
  const input = inputRef.value;
  if (!input) {
    return;
  }
  const text = state.value.inputValue;
  if (input.value !== text) {
    input.value = text;
  }
  handledText = input.value;
  if (pendingCaret !== null) {
    const caret = pendingCaret;
    pendingCaret = null;
    input.setSelectionRange(caret, caret);
  }
}

onMounted(() => {
  handledText = inputRef.value?.value;
});
watch(() => state.value.inputValue, writeTextToInput, { flush: 'post' });

useValueChanged(
  () => state.value.value,
  () => {
    // The root clears the error of the field for the change of a native reset, and the value of a
    // reset starts no validation.
    if (isResetChangePending.value) {
      return;
    }

    clearErrors(name.value);

    if (blockRevalidation && !shouldValidateOnChange()) {
      blockRevalidation = false;
      return;
    }

    validation.change(state.value.value);
  },
);

function handleFocusin() {
  // Read-only inputs are still focusable; only the value-changing handlers stay gated on it.
  if (state.value.disabled) {
    return;
  }

  setFocused(true);
}

function handleFocusout(event: FocusEvent) {
  const { disabled, readOnly, value, inputValue } = state.value;
  if (disabled) {
    return;
  }

  setTouched(true);
  setFocused(false);

  if (readOnly) {
    return;
  }

  const hadManualInput = !allowInputSyncRef.value;
  const hadPendingProgrammaticChange = hasPendingCommitRef.value;

  allowInputSyncRef.value = true;

  if (inputValue.trim() === '') {
    const clearDetails = createChangeEventDetails(REASONS.inputClear, event);
    setValue(null, clearDetails);
    // Respect a canceled clear, mirroring the non-empty blur path below.
    if (clearDetails.isCanceled) {
      return;
    }
    if (validationMode.value === 'onBlur') {
      void validation.commit(null);
    }
    // Don't report a commit when blurring an already-empty field that the user never
    // interacted with: nothing was cleared and no programmatic change is pending.
    if (hadManualInput || hadPendingProgrammaticChange || value !== null) {
      onValueCommitted(null, createGenericEventDetails(REASONS.inputClear, event));
    }
    return;
  }

  const formatOptions = formatOptionsRef.value;

  // Without a manual edit, the visible text is purely formatted display, so keep the
  // authoritative numeric value rather than re-parsing it: rounded text discards precision,
  // and compact text (`1.2K`) can't be reversed (e.g. focus/blur with no edits, or blur after
  // a programmatic change).
  let committed = hadManualInput ? parseNumber(inputValue, locale.value, formatOptions) : value;
  if (hadManualInput && committed === null) {
    return;
  }

  // Explicit rounding options apply to the committed value, whether typed or external. Avoid
  // applying Intl's default precision unless the format opts into rounding.
  if (committed !== null && hasNumberFormatRoundingOptions(formatOptions)) {
    committed = removeFloatingPointErrors(committed, formatOptions);
  }

  const nextEventDetails = createGenericEventDetails(REASONS.inputBlur, event);
  // A `NaN` value never equals itself, so don't treat it as changed on every blur
  const shouldUpdateValue = value !== committed && !Number.isNaN(committed);
  const shouldCommit = hadManualInput || shouldUpdateValue || hadPendingProgrammaticChange;

  // Use the stored value after `setValue` clamps it.
  let committedValue = committed;
  if (shouldUpdateValue) {
    const changeDetails = createChangeEventDetails(REASONS.inputBlur, event);
    blockRevalidation = true;
    setValue(committed, changeDetails);
    if (changeDetails.isCanceled) {
      blockRevalidation = false;
      return;
    }
    committedValue = lastChangedValueRef.value;
    // If validation normalized back to the current value, `useValueChanged` won't fire to
    // reset the flag, so reset it here or the next external change won't revalidate.
    if (committedValue === value) {
      blockRevalidation = false;
    }
  }
  if (validationMode.value === 'onBlur') {
    void validation.commit(committedValue);
  }
  if (shouldCommit) {
    onValueCommitted(committedValue, nextEventDetails);
  }

  // Normalize only the displayed text
  const canonicalText = formatNumber(committedValue, locale.value, formatOptions);
  if (inputValue !== canonicalText) {
    setInputValue(canonicalText);
  }
}

// A write to the input while a composition runs stops the composition. The write then waits for
// `compositionend`.
function refuseChange(event: Event) {
  if (!(event as InputEvent).isComposing) {
    writeTextToInput();
  }
}

function handleInput(event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  const targetValue = input.value;
  handledText = targetValue;

  // A listener of the consumer can prevent the event before this handler runs.
  if (event.defaultPrevented) {
    refuseChange(event);
    return;
  }

  if (targetValue.trim() === '') {
    allowInputSyncRef.value = false;
    setInputValue(targetValue);
    setValue(null, createChangeEventDetails(REASONS.inputClear, event));
    return;
  }

  // Update the input text immediately and only fire onValueChange if the typed value is
  // currently parseable into a number. This preserves good UX for IME
  // composition/partial input while still providing live numeric updates when possible.
  const allowedNonNumericKeys = getAllowedNonNumericKeys();
  const isValidCharacterString = Array.from(targetValue).every(
    (ch) =>
      isNumeralChar(ch) ||
      ANY_MINUS_DETECT_RE.test(ch) ||
      allowedNonNumericKeys.has(ch) ||
      // Bidi/format controls are stripped by `parseNumber`; don't let them reject the string
      // (RTL locales insert them around exponent/currency signs, e.g. scientific notation).
      FORMAT_CONTROL_DETECT_RE.test(ch),
  );

  // A rejected change leaves the synced text in place, so it doesn't count as a manual edit
  if (!isValidCharacterString) {
    refuseChange(event);
    return;
  }

  allowInputSyncRef.value = false;
  const parsedValue = parseNumber(targetValue, locale.value, formatOptionsRef.value);

  setInputValue(targetValue);

  if (parsedValue !== null) {
    setValue(parsedValue, createChangeEventDetails(REASONS.inputChange, event));
  }
}

const compositionTimeout = useTimeout();

// WebKit sends the last `input` event of a composition after `compositionend`, so the write waits
// for the next task.
function handleCompositionend() {
  compositionTimeout.start(0, writeTextToInput);
}

// React calls `onChange` of a text input for an `input` event and for a `change` event, when the
// value is new. Some programs that fill a form send only `change`.
function handleChange(event: Event) {
  if ((event.currentTarget as HTMLInputElement).value !== handledText) {
    handleInput(event);
  }
}

function handleKeydown(event: KeyboardEvent) {
  const { disabled, readOnly, inputValue } = state.value;
  if (event.defaultPrevented || readOnly || disabled) {
    return;
  }

  const input = event.currentTarget as HTMLInputElement;

  // Snapshot the dirty state without clearing it: navigation/allowed keys (ArrowLeft, Tab,
  // Enter, Escape, …) return early without changing the value, so marking the input synced
  // here would wrongly discard dirty-input authority. Only the value-changing branches below
  // mark it synced.
  const hadManualInput = !allowInputSyncRef.value;

  const allowedNonNumericKeys = getAllowedNonNumericKeys();

  let isAllowedNonNumericKey = allowedNonNumericKeys.has(event.key);

  const { decimal, currency, percentSign } = getNumberLocaleDetails(
    locale.value,
    formatOptionsRef.value,
  );

  const selectionStart = input.selectionStart;
  const selectionEnd = input.selectionEnd;
  const isAllSelected = selectionStart === 0 && selectionEnd === inputValue.length;

  const selectionContainsIndex = (index: number) =>
    selectionStart != null &&
    selectionEnd != null &&
    index >= selectionStart &&
    index < selectionEnd;

  // Only allow a single sign character: permit it when there is no existing sign of either
  // kind, when all text is selected, or when the selection covers the existing sign so it's
  // being replaced.
  const signGroups = [
    [ANY_MINUS_DETECT_RE, ANY_MINUS_RE],
    [ANY_PLUS_DETECT_RE, ANY_PLUS_RE],
  ] as const;
  signGroups.forEach(([detectRe, globalRe]) => {
    if (
      detectRe.test(event.key) &&
      Array.from(allowedNonNumericKeys).some((k) => detectRe.test(k))
    ) {
      const existingIndex = inputValue.search(globalRe);
      const isReplacingExisting = existingIndex !== -1 && selectionContainsIndex(existingIndex);
      isAllowedNonNumericKey =
        !(ANY_MINUS_DETECT_RE.test(inputValue) || ANY_PLUS_DETECT_RE.test(inputValue)) ||
        isAllSelected ||
        isReplacingExisting;
    }
  });

  // Only allow one of each symbol.
  [decimal, currency, percentSign].forEach((symbol) => {
    if (event.key === symbol) {
      const symbolIndex = inputValue.indexOf(symbol);
      const isSymbolHighlighted = selectionContainsIndex(symbolIndex);
      isAllowedNonNumericKey = symbolIndex === -1 || isAllSelected || isSymbolHighlighted;
    }
  });

  const isNavigateKey = NAVIGATE_KEYS.has(event.key);
  // Alt+ArrowUp/ArrowDown selects smallStep, so don't treat it as a bypass modifier.
  const isStepKey = event.key === 'ArrowUp' || event.key === 'ArrowDown';

  if (
    // Allow composition events (e.g., pinyin)
    // event.isComposing does not work in Safari:
    // https://bugs.webkit.org/show_bug.cgi?id=165004
    event.which === 229 ||
    (event.altKey && !isStepKey) ||
    event.ctrlKey ||
    event.metaKey ||
    isAllowedNonNumericKey ||
    isNumeralChar(event.key) ||
    isNavigateKey
  ) {
    return;
  }

  // Home/End jump to the corresponding bound, but only when that bound is defined.
  let boundaryValue: number | null = null;
  if (event.key === 'Home' && min.value != null) {
    boundaryValue = min.value;
  } else if (event.key === 'End' && max.value != null) {
    boundaryValue = max.value;
  }

  // Let the browser handle multi-character keys we don't act on (PageUp, Insert, F-keys,
  // Home/End without min/max); invalid single characters are still blocked below.
  if (event.key.length > 1 && !isStepKey && boundaryValue === null) {
    return;
  }

  // Step from the authoritative numeric value unless the input has unsaved manual edits.
  // When the text is already synced, parsing the rounded display would collapse precision,
  // so pass no `currentValue` and let `incrementValue` fall back to the numeric state
  // (mirrors the button path).
  const currentValue = hadManualInput
    ? parseNumber(inputValue, locale.value, formatOptionsRef.value)
    : null;

  const amount = getStepAmount(event);

  // Prevent insertion of text or caret from moving.
  event.preventDefault();
  event.stopPropagation();

  const commitDetails = createGenericEventDetails(REASONS.keyboard, event);

  let changed = false;
  if (isStepKey || boundaryValue !== null) {
    allowInputSyncRef.value = true;
  }
  if (isStepKey) {
    // When stepping from the synced numeric state, refresh the commit ref to the current
    // value so a canceled step can't commit a stale `lastChangedValueRef` left over from an
    // earlier change (mirrors the button path).
    if (!hadManualInput) {
      lastChangedValueRef.value = valueRef.value;
    }

    changed = incrementValue(amount, {
      direction: event.key === 'ArrowUp' ? 1 : -1,
      currentValue,
      event,
      reason: REASONS.keyboard,
    });
  } else if (boundaryValue !== null) {
    changed = setValue(boundaryValue, createChangeEventDetails(REASONS.keyboard, event));
  }

  // `changed` is only true when `setValue` applied the change, which records the stored
  // (clamped/snapped) value, so commit that rather than the pre-validation input.
  if (changed) {
    onValueCommitted(lastChangedValueRef.value, commitDetails);
  }
}

function handlePaste(event: ClipboardEvent) {
  const { disabled, readOnly, inputValue } = state.value;
  if (event.defaultPrevented || readOnly || disabled) {
    return;
  }

  let pastedData: string;

  try {
    pastedData = event.clipboardData?.getData('text/plain') ?? '';
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      warn(
        '<NumberField.Input> could not read clipboard text during paste handling.',
        'The part then ignores the paste.',
        'Allow the page to read the clipboard, or type the number.',
      );
    }

    return;
  }

  // Prevent `input` from being called.
  event.preventDefault();

  // Insert the pasted text at the caret/selection instead of replacing the entire value,
  // matching native input behavior (e.g. pasting "5" into "123|" yields "1235").
  // The component renders `type="text"`, which always reports a selection range. Overriding
  // `type` with a selection-less one (`email`, `number`) is unsupported either way: the caret
  // restore below throws on those, so there is no working behavior to preserve here.
  const input = event.currentTarget as HTMLInputElement;
  const selectionStart = input.selectionStart!;
  const selectionEnd = input.selectionEnd!;
  const nextText =
    inputValue.slice(0, selectionStart) + pastedData + inputValue.slice(selectionEnd);

  const parsedValue = parseNumber(nextText, locale.value, formatOptionsRef.value);

  if (parsedValue !== null) {
    allowInputSyncRef.value = false;
    pendingCaret = selectionStart + pastedData.length;
    setValue(parsedValue, createChangeEventDetails(REASONS.inputPaste, event));
    setInputValue(nextText);
    writeTextToInput();
  }
}

// A template can mount the input that replaces this input before it unmounts this input. The input
// then clears the context only when the element is its own.
let ownInput: HTMLInputElement | null = null;
function setOwnInput(next: HTMLElement | null) {
  const input = next as HTMLInputElement | null;
  if (input !== null || inputRef.value === ownInput) {
    inputRef.value = input;
  }
  ownInput = input;
}

const { element, elementProps } = useRenderElement('input', props, {
  state,
  ref: setOwnInput,
  props: (attrs) => {
    // Vue before 3.5.14 sets the key `autocorrect` as a boolean DOM property, and the string `off`
    // then turns autocorrect on. Vue sets the key `autoCorrect` as an attribute in each version, and
    // a server writes it in lower case. The value of the consumer moves to that key, because two
    // keys for one attribute give two attributes on a server.
    const { autocorrect, ...elementAttrs } = attrs;

    return [
      {
        id: id.value,
        form: form.value,
        required: state.value.required ? '' : undefined,
        disabled: state.value.disabled ? '' : undefined,
        readonly: state.value.readOnly ? '' : undefined,
        inputmode: inputMode.value,
        value: state.value.inputValue,
        type: 'text',
        autocomplete: 'off',
        autoCorrect: autocorrect === undefined ? 'off' : autocorrect,
        spellcheck: 'false',
        'aria-roledescription': 'Number field',
        'aria-invalid': !state.value.disabled && invalid.value ? true : undefined,
        'aria-labelledby': labelId.value,
        onFocusin: handleFocusin,
        onFocusout: handleFocusout,
        onInput: handleInput,
        onChange: handleChange,
        onKeydown: handleKeydown,
        onPaste: handlePaste,
        onCompositionend: handleCompositionend,
        // Vue adds the listener with no `passive` option, so `preventDefault` stops the scroll of
        // the page.
        onWheel: isWheelScrubEnabled.value ? onInputWheel : undefined,
      },
      elementAttrs,
      (merged) => validation.getValidationProps(state.value.disabled, merged),
    ];
  },
  stateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" />
</template>
