<script lang="ts">
import type { InputHTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { NumberFieldRootState } from '../root/NumberFieldRoot.vue';

export interface NumberFieldInputState extends NumberFieldRootState {}

// The type of `autocomplete` in `InputHTMLAttributes` is a union that is too large for vue-tsc.
// With it, `defineProps` gives the error TS2590.
interface NumberFieldInputAutocomplete {
  autocomplete?: string | null | undefined;
}

export interface NumberFieldInputProps
  extends
    VaseUIComponentProps<NumberFieldInputState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<InputHTMLAttributes>, 'autocomplete'>,
    /* @vue-ignore */ NumberFieldInputAutocomplete {}
</script>

<script setup lang="ts">
import { computed, inject, nextTick, shallowRef, watch } from 'vue';
import { formatNumber } from '../../common/formatNumber';
import { useIsHydrated, useValueBeforeHydration } from '../../common/hydration';
import { platform } from '../../common/platform';
import { useTimeout } from '../../common/useTimeout';
import { warn } from '../../common/warn';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createVaseUIEventDetails';
import { useDeferredServerRender } from '../../common/deferredServerRender';
import { controlAria, describedByWith, fieldKey } from '../../field/control';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useInputRender } from '../../internals/useInputRender';
import { useRenderElement } from '../../internals/useRenderElement';
import { useValueChanged } from '../../internals/useValueChanged';
import { useNumberFieldRootContext, stateAttributesMapping } from '../root/NumberFieldRootContext';
import {
  BASE_NON_NUMERIC_SYMBOLS,
  getAllFormatParts,
  getLocaleDigits,
  MINUS_SIGNS_WITH_ASCII,
  PERCENTAGES,
  PERMILLE,
  PLUS_SIGNS_WITH_ASCII,
  SPACE_SEPARATOR_RE,
  ANY_MINUS_DETECT_RE,
  ANY_MINUS_RE,
  ANY_PLUS_DETECT_RE,
  ANY_PLUS_RE,
  FORMAT_CONTROL_DETECT_RE,
  getNumberLocaleDetails,
  isNumeralChar,
  parseNumber,
  hasNumberFormatRoundingOptions,
  removeFloatingPointErrors,
} from '../utils/parse';

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
  getStepAmount,
  id,
  incrementValue,
  setValue,
  state,
  options,
  setInputValue,
  setEditing,
  prepareStep,
  registerInput,
  locale,
  onValueCommitted,
  lastChangedValueRef,
  hasPendingCommitRef,
  onInputWheel,
  isWheelScrubEnabled,
  isResetChangePending,
} = useNumberFieldRootContext();

const isHydrated = useIsHydrated();
const inputMode = computed<'numeric' | 'decimal' | 'text'>(() => {
  if (!isHydrated.value || !platform.os.ios) {
    return 'numeric';
  }
  return options.min != null && options.min >= 0 ? 'decimal' : 'text';
});

const allowedNonNumericKeys = computed(() => {
  const format = options.format;
  const parts = getAllFormatParts(locale.value, format);

  const keys = new Set<string>(BASE_NON_NUMERIC_SYMBOLS);
  const addAll = (chars: readonly string[]) => chars.forEach((char) => keys.add(char));

  // A locale can omit its decimal separator from an integer format.
  const decimal =
    parts.find((part) => part.type === 'decimal')?.value ??
    getNumberLocaleDetails(locale.value, format).decimal;
  keys.add(decimal);

  // Compact suffixes have no inverse in the number parser.
  parts.forEach((part) => {
    if (
      part.type === 'integer' ||
      part.type === 'fraction' ||
      part.type === 'exponentInteger' ||
      part.type === 'compact'
    ) {
      return;
    }
    addAll(Array.from(part.value));
    if (SPACE_SEPARATOR_RE.test(part.value)) {
      keys.add(' ');
    }
  });
  // Digits follow the locale's numbering system, such as `১২` in bn-BD
  addAll(getLocaleDigits(locale.value, format));

  const formatStyle = format?.style;
  const allowPercentSymbols =
    formatStyle === 'percent' || (formatStyle === 'unit' && format?.unit === 'percent');
  const allowPermilleSymbols =
    formatStyle === 'percent' || (formatStyle === 'unit' && format?.unit === 'permille');

  // Tolerate percent/permille variants the formatter doesn't emit but users may type or paste.
  if (allowPercentSymbols) {
    addAll(PERCENTAGES);
  }
  if (allowPermilleSymbols) {
    addAll(PERMILLE);
  }

  addAll(PLUS_SIGNS_WITH_ASCII);
  if ((options.min ?? Number.MIN_SAFE_INTEGER) < 0 || options.allowOutOfRange) {
    addAll(MINUS_SIGNS_WITH_ASCII);
    // Accounting formats show negatives in parentheses, such as `($1.00)`
    if (format?.currencySign === 'accounting') {
      addAll(['(', ')']);
    }
  }

  return keys;
});

const field = inject(fieldKey, null);

// The input binds `aria-labelledby` and `aria-describedby`, and a label or a message can come after
// it.
useDeferredServerRender();

const { valueProps, renderValue } = useInputRender();

const writesValue = useValueBeforeHydration(props, () => element.value);

useValueChanged(
  () => state.value.value,
  () => {
    // The root clears the error of the field for the change of a native reset, and the value of a
    // reset starts no validation.
    if (isResetChangePending.value) {
      return;
    }

    field?.onEdit();
  },
);

function handleFocusout(event: FocusEvent) {
  const { disabled, readOnly, value, inputValue } = state.value;
  if (event.defaultPrevented || disabled) {
    return;
  }

  field?.onLeave(event.currentTarget as Element);

  if (readOnly) {
    return;
  }

  const hadManualInput = setEditing(false);
  const hadPendingProgrammaticChange = hasPendingCommitRef.value;

  if (inputValue.trim() === '') {
    const clearDetails = createChangeEventDetails(REASONS.inputClear, event);
    setValue(null, clearDetails);
    // Respect a canceled clear, mirroring the non-empty blur path below.
    if (clearDetails.isCanceled) {
      return;
    }
    // Don't report a commit when blurring an already-empty field that the user never
    // interacted with: nothing was cleared and no programmatic change is pending.
    if (hadManualInput || hadPendingProgrammaticChange || value !== null) {
      onValueCommitted(null, createGenericEventDetails(REASONS.inputClear, event));
    }
    return;
  }

  const formatOptions = options.format;

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
    setValue(committed, changeDetails);
    if (changeDetails.isCanceled) {
      return;
    }
    committedValue = lastChangedValueRef.value;
  }
  if (shouldCommit) {
    onValueCommitted(committedValue, nextEventDetails);
  }

  // Normalize only the displayed text
  setInputValue(formatNumber(committedValue, locale.value, formatOptions));
}

// An unrelated patch must preserve the text that the IME is still editing.
const composingText = shallowRef<string | null>(null);
const compositionTimeout = useTimeout();

function handleCompositionstart(event: CompositionEvent) {
  compositionTimeout.clear();
  composingText.value = (event.currentTarget as HTMLInputElement).value;
}

function handleInput(event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  const targetValue = input.value;
  if (composingText.value !== null || (event as InputEvent).isComposing) {
    composingText.value = targetValue;
  }

  // A listener of the consumer can prevent the event before this handler runs.
  if (event.defaultPrevented) {
    renderValue();
    return;
  }

  if (targetValue.trim() === '') {
    setEditing(true);
    setInputValue(targetValue);
    setValue(null, createChangeEventDetails(REASONS.inputClear, event));
    return;
  }

  // Update the input text immediately and only fire onValueChange if the typed value is
  // currently parseable into a number. This preserves good UX for IME
  // composition/partial input while still providing live numeric updates when possible.
  const isValidCharacterString = Array.from(targetValue).every(
    (ch) =>
      isNumeralChar(ch) ||
      ANY_MINUS_DETECT_RE.test(ch) ||
      allowedNonNumericKeys.value.has(ch) ||
      // Bidi/format controls are stripped by `parseNumber`; don't let them reject the string
      // (RTL locales insert them around exponent/currency signs, e.g. scientific notation).
      FORMAT_CONTROL_DETECT_RE.test(ch),
  );

  // A rejected change leaves the synced text in place, so it doesn't count as a manual edit
  if (!isValidCharacterString) {
    renderValue();
    return;
  }

  setEditing(true);
  const parsedValue = parseNumber(targetValue, locale.value, options.format);

  setInputValue(targetValue);

  if (parsedValue !== null) {
    setValue(parsedValue, createChangeEventDetails(REASONS.inputChange, event));
  }
}

// WebKit sends the final input after compositionend.
function handleCompositionend() {
  compositionTimeout.start(0, () => {
    composingText.value = null;
  });
}

function handleKeydown(event: KeyboardEvent) {
  const { disabled, readOnly, inputValue } = state.value;
  if (event.defaultPrevented || readOnly || disabled) {
    return;
  }

  const input = event.currentTarget as HTMLInputElement;

  let isAllowedNonNumericKey = allowedNonNumericKeys.value.has(event.key);

  const { decimal, currency, percentSign } = getNumberLocaleDetails(locale.value, options.format);

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
      Array.from(allowedNonNumericKeys.value).some((k) => detectRe.test(k))
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
  if (event.key === 'Home' && options.min != null) {
    boundaryValue = options.min;
  } else if (event.key === 'End' && options.max != null) {
    boundaryValue = options.max;
  }

  // Let the browser handle multi-character keys we don't act on (PageUp, Insert, F-keys,
  // Home/End without min/max); invalid single characters are still blocked below.
  if (event.key.length > 1 && !isStepKey && boundaryValue === null) {
    return;
  }

  // Prevent insertion of text or caret from moving.
  event.preventDefault();
  event.stopPropagation();

  if (!isStepKey && boundaryValue === null) return;
  let changed;
  if (isStepKey) {
    const currentValue = prepareStep()
      ? parseNumber(inputValue, locale.value, options.format)
      : null;
    changed = incrementValue(getStepAmount(event), {
      direction: event.key === 'ArrowUp' ? 1 : -1,
      currentValue,
      event,
      reason: REASONS.keyboard,
    });
  } else {
    setEditing(false);
    changed = setValue(boundaryValue, createChangeEventDetails(REASONS.keyboard, event));
  }

  // `changed` is only true when `setValue` applied the change, which records the stored
  // (clamped/snapped) value, so commit that rather than the pre-validation input.
  if (changed) {
    onValueCommitted(lastChangedValueRef.value, createGenericEventDetails(REASONS.keyboard, event));
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
  /* eslint-disable @typescript-eslint/no-non-null-assertion -- An input of `type="text"` always reports a selection range. */
  const selectionStart = input.selectionStart!;
  const selectionEnd = input.selectionEnd!;
  /* eslint-enable @typescript-eslint/no-non-null-assertion */
  const nextText =
    inputValue.slice(0, selectionStart) + pastedData + inputValue.slice(selectionEnd);

  const parsedValue = parseNumber(nextText, locale.value, options.format);

  if (parsedValue !== null) {
    setEditing(true);
    setValue(parsedValue, createChangeEventDetails(REASONS.inputPaste, event));
    setInputValue(nextText);
    // Vue's write of the text puts the caret at the end of the input. The part moves the caret
    // behind the pasted text.
    const caret = selectionStart + pastedData.length;
    void nextTick(() => {
      input.setSelectionRange(caret, caret);
    });
  }
}

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('input', props, {
  state,
  props: (attrs) => {
    // Vue before 3.5.14 sets the key `autocorrect` as a boolean DOM property, and the string `off`
    // then turns autocorrect on. Vue sets the key `autoCorrect` as an attribute in each version, and
    // a server writes it in lower case. The value of the consumer moves to that key, because two
    // keys for one attribute give two attributes on a server.
    const { autocorrect, ...elementAttrs } = attrs;

    return [
      {
        id: id.value,
        form: options.form,
        required: state.value.required ? '' : undefined,
        disabled: state.value.disabled ? '' : undefined,
        readonly: state.value.readOnly ? '' : undefined,
        inputmode: inputMode.value,
        ...(writesValue.value
          ? valueProps(composingText.value ?? state.value.inputValue)
          : undefined),
        type: 'text',
        autocomplete: 'off',
        autoCorrect: autocorrect === undefined ? 'off' : autocorrect,
        spellcheck: 'false',
        'aria-roledescription': 'Number field',
        ...(field && controlAria(field)),
        onFocusout: handleFocusout,
        onInput: handleInput,
        onKeydown: handleKeydown,
        onPaste: handlePaste,
        onCompositionstart: handleCompositionstart,
        onCompositionend: handleCompositionend,
        // Vue adds the listener with no `passive` option, so `preventDefault` stops the scroll of
        // the page.
        onWheel: isWheelScrubEnabled.value ? onInputWheel : undefined,
      },
      elementAttrs,
      field
        ? { 'aria-describedby': describedByWith(field, elementAttrs['aria-describedby']) }
        : undefined,
    ];
  },
  stateAttributesMapping,
});

// A replacement input can mount before the old input releases its registration.
watch(
  element,
  (input, _, onCleanup) => {
    if (input) onCleanup(registerInput(input as HTMLInputElement));
  },
  { flush: 'sync' },
);

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef" />
</template>
