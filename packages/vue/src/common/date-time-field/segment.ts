import { computed, nextTick, shallowRef, watch, type Ref } from 'vue';
import { createChangeEventDetails } from '../changeEventDetails';
import { platform } from '../platform';
import {
  injectDateTimeField,
  stateAttributes,
  type DateTimeFieldChangeEventDetails,
  type DateTimeFieldSegment,
  type DateTimeFieldState,
  type SegmentSpin,
} from './field';
import {
  PAGE_STEPS,
  dayPeriodOfLetter,
  digitOf,
  isNumericType,
  typeDigit,
  type DayPeriod,
  type EditableSegmentType,
} from './layout';

export type EditableSegment = Extract<DateTimeFieldSegment, { editable: true }>;

export interface DateTimeFieldSegmentState extends DateTimeFieldState {
  type: EditableSegmentType;
  /** The segment has no number, so it shows its placeholder. */
  placeholder: boolean;
}

/**
 * Writes the attributes again after the mount. Vue keeps the attributes of an element that it
 * hydrates, and a server with other `Intl` data puts another segment or literal in its place
 * (test/measurements/date-time-field.test.ts).
 */
export function writeAttributes(element: Element, attributes: Record<string, unknown>) {
  for (const [name, value] of Object.entries(attributes)) {
    if (/^on[A-Z]/.test(name) || name === 'value') continue;
    if (value == null || value === false) element.removeAttribute(name);
    else if (value === true) element.setAttribute(name, '');
    else if (typeof value === 'string' || typeof value === 'number') {
      element.setAttribute(name, String(value));
    }
  }
}

/** The keys, the text and the focus of one editable segment. */
export function useDateTimeFieldSegment(
  segment: () => EditableSegment,
  element: Readonly<Ref<HTMLInputElement | null>>,
) {
  const field = injectDateTimeField();
  const type = computed(() => segment().type);
  const view = computed(() => field.view(type.value));
  // The digits that the user typed since the segment got the focus.
  let typedDigits = '';
  // The text of an open composition. The segment reads it one time at its end.
  const composing = shallowRef<string | null>(null);

  watch(
    element,
    (el, _, onCleanup) => {
      if (el) onCleanup(field.addSegment(el, () => type.value));
    },
    { flush: 'sync' },
  );

  const state = computed<DateTimeFieldSegmentState>(() => ({
    ...field.state,
    type: type.value,
    placeholder: view.value.number === undefined,
  }));

  const canChange = () => !field.state.disabled && !field.state.readonly;

  function moveFocus(step: 1 | -1) {
    if (element.value) field.moveFocus(element.value, step);
  }

  // A segment is full at the length of its greatest number, or when no next digit fits. The focus
  // then goes to the next segment.
  function typeText(text: string, event: Event) {
    const details = createChangeEventDetails('input-change', event);
    const segmentType = type.value;
    let full = false;
    let accepted = false;
    if (isNumericType(segmentType)) {
      const { min, max } = view.value;
      let number: number | undefined;
      for (const character of text) {
        const digit = digitOf(character, field.digits);
        if (digit === undefined) continue;
        const typed = typeDigit(typedDigits, digit, { min, max });
        typedDigits = typed.digits;
        number = typed.number ?? number;
        full = typed.advance;
        if (full) break;
      }
      if (number !== undefined) accepted = field.setNumber(segmentType, number, details);
    } else {
      let dayPeriod: DayPeriod | undefined;
      for (const character of text)
        dayPeriod ??= dayPeriodOfLetter(character, field.dayPeriodTexts);
      if (dayPeriod !== undefined) accepted = full = field.setDayPeriod(dayPeriod, details);
    }
    if (full && accepted) moveFocus(1);
  }

  // Backspace in an empty segment goes back to the segment before.
  function empty(details: DateTimeFieldChangeEventDetails, backward: boolean) {
    typedDigits = '';
    const segmentType = type.value;
    if (view.value.number === undefined) {
      if (backward) moveFocus(-1);
    } else if (isNumericType(segmentType)) {
      field.setNumber(segmentType, undefined, details);
    } else {
      field.setDayPeriod(undefined, details);
    }
  }

  function spin(action: SegmentSpin, event: KeyboardEvent) {
    typedDigits = '';
    field.spin(type.value, action, createChangeEventDetails('keyboard', event));
  }

  // The text that the browser put in the input: the digits after the text of the segment, or the
  // whole text when it replaced the text of the segment.
  function commitText(actual: string, event: Event) {
    const shown = view.value.text;
    typeText(actual.startsWith(shown) ? actual.slice(shown.length) : actual, event);
  }

  // The text of the segment changes only through its number.
  function showText(input: HTMLInputElement) {
    void nextTick(() => {
      const shown = composing.value ?? view.value.text;
      if (input.value !== shown) input.value = shown;
    });
  }

  function onKeydown(event: KeyboardEvent) {
    // An input method owns its keys. WebKit gives key code 229 and no `isComposing`:
    // https://bugs.webkit.org/show_bug.cgi?id=165004
    if (
      event.defaultPrevented ||
      composing.value !== null ||
      event.isComposing ||
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- the one sign of WebKit
      event.keyCode === 229 ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey
    ) {
      return;
    }
    const segmentType = type.value;
    const changes = canChange();
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowRight': {
        const rtl = getComputedStyle(event.currentTarget as Element).direction === 'rtl';
        moveFocus((event.key === 'ArrowRight') !== rtl ? 1 : -1);
        break;
      }
      case 'ArrowUp':
      case 'ArrowDown':
      case 'PageUp':
      case 'PageDown': {
        const step =
          event.key.startsWith('Page') && isNumericType(segmentType) ? PAGE_STEPS[segmentType] : 1;
        if (changes) spin(event.key.endsWith('Up') ? step : -step, event);
        break;
      }
      case 'Home':
      case 'End':
        if (changes) spin(event.key === 'Home' ? 'min' : 'max', event);
        break;
      // WebKit sends no `beforeinput` for Backspace in an empty input, so the key does the work.
      case 'Backspace':
      case 'Delete':
        if (changes) empty(createChangeEventDetails('keyboard', event), event.key === 'Backspace');
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  function onBeforeinput(event: InputEvent) {
    if (
      composing.value !== null ||
      event.isComposing ||
      event.inputType === 'insertCompositionText'
    ) {
      return;
    }
    event.preventDefault();
    if (!canChange()) return;
    if (event.inputType === 'insertText') {
      typeText(event.data ?? '', event);
    } else if (event.inputType.startsWith('deleteContent')) {
      empty(
        createChangeEventDetails('input-clear', event),
        event.inputType === 'deleteContentBackward',
      );
    }
  }

  // An `input` with no `beforeinput` that the segment could cancel, such as a text of an input
  // method on Android.
  function onInput(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    if (composing.value !== null) {
      composing.value = input.value;
      return;
    }
    // WebKit sends the last `input` of a composition after `compositionend`. The text of the
    // segment then starts with the input, so it adds no digit.
    const inputType = (event as Partial<InputEvent>).inputType ?? '';
    if (canChange()) {
      if (inputType.startsWith('deleteContent')) {
        empty(
          createChangeEventDetails('input-clear', event),
          inputType === 'deleteContentBackward',
        );
      } else {
        commitText(input.value, event);
      }
    }
    showText(input);
  }

  const ownProps = computed(() => {
    const current = view.value;
    const first = field.segments.find((item) => item.editable)?.type === type.value;
    return {
      id: first ? field.id : undefined,
      type: 'text',
      role: 'spinbutton',
      inputmode: type.value === 'dayPeriod' ? 'text' : 'numeric',
      autocomplete: 'off',
      spellcheck: 'false',
      size: current.size,
      placeholder: current.placeholder,
      'aria-label': current.label,
      'aria-valuemin': current.min,
      'aria-valuemax': current.max,
      'aria-valuenow': current.number,
      'aria-valuetext': current.valueText,
      'aria-required': field.state.required ? 'true' : undefined,
      'aria-invalid': field.invalid ? 'true' : undefined,
      disabled: field.state.disabled,
      readonly: field.state.readonly,
      value: composing.value ?? current.text,
      'data-type': type.value,
      // CSS has `:disabled`, `:read-only` and the ARIA attributes for the rest of the state.
      ...stateAttributes(field.state),
      'data-disabled': undefined,
      'data-invalid': undefined,
      'data-readonly': undefined,
      'data-required': undefined,
      // A server with other `Intl` data has another layout, and the segments of the browser fix
      // their attributes after the mount.
      'data-allow-mismatch': 'attribute',
      onMousedown(event: MouseEvent) {
        if (field.state.disabled) return;
        // The browser would put the caret in the text.
        event.preventDefault();
        element.value?.focus();
        element.value?.select();
      },
      // A focus by script puts the caret at the start in Chromium and Firefox, and selects the
      // text in WebKit (test/measurements/date-time-field.test.ts).
      onFocus(event: FocusEvent) {
        typedDigits = '';
        (event.currentTarget as HTMLInputElement).select();
      },
      onBlur() {
        typedDigits = '';
      },
      onKeydown,
      onBeforeinput,
      onInput,
      onPaste(event: ClipboardEvent) {
        if (!canChange()) return;
        event.preventDefault();
        field.paste(event.clipboardData?.getData('text/plain') ?? '', event);
      },
      onCompositionstart() {
        // Android keyboards give most text as a composition, so each `input` gives its text.
        if (!platform.os.android) composing.value = view.value.text;
      },
      onCompositionend(event: CompositionEvent) {
        if (composing.value === null) return;
        composing.value = null;
        const input = event.currentTarget as HTMLInputElement;
        if (canChange()) commitText(input.value, event);
        showText(input);
      },
    };
  });

  return { state, ownProps };
}
