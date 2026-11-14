import { computed, nextTick, shallowRef, toValue, watch } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { useIsHydrating } from '../../../common/hydration';
import { platform } from '../../../common/platform';
import { stopEvent } from '../../../utils/popups/event';
import { createChangeEventDetails } from '../../createBaseUIEventDetails';
import { useDirection } from '../../direction-context/DirectionContext';
import { fieldValidityMapping } from '../../field-constants';
import { useSetFieldFocused } from '../../field-root-context/useSetFieldFocused';
import type { StateAttributesMapping } from '../../getStateAttributesProps';
import { REASONS } from '../../reasons';
import { useDateTimeFieldContext } from './DateTimeFieldContext';
import type {
  DateTimeFieldChangeEventDetails,
  DateTimeFieldRootState,
  DateTimeFieldSegment,
  SegmentSpin,
} from './DateTimeFieldContext';
import type { EditableSegmentType } from './segmentLayout';
import {
  PAGE_STEPS,
  dayPeriodOfLetter,
  digitOf,
  isNumericType,
  removeLastDigit,
  typeDigit,
} from './segmentRanges';
import type { DayPeriod } from './segmentRanges';

export type EditableDateTimeFieldSegment = Extract<DateTimeFieldSegment, { editable: true }>;

export interface DateTimeFieldSegmentState extends DateTimeFieldRootState {
  type: EditableSegmentType;
  /** Whether the segment has no number, so that it shows its placeholder. */
  placeholder: boolean;
  index: number;
}

export const segmentStateAttributesMapping: StateAttributesMapping<DateTimeFieldSegmentState> = {
  index: () => null,
  ...fieldValidityMapping,
};

export interface UseDateTimeFieldSegmentReturnValue {
  state: ComputedRef<DateTimeFieldSegmentState>;
  /** The props of the `input` element. The part merges the attributes of the consumer after them. */
  props: ComputedRef<Record<string, any>>;
  /** The part gives it to the `ref` of its element. */
  setElement: (element: unknown) => void;
}

/**
 * The keys, the typing, the focus and the composition of one editable segment. A segment part
 * calls it in `setup`, inside a root that called `useDateTimeFieldRoot`.
 */
export function useDateTimeFieldSegment(
  segment: MaybeRefOrGetter<EditableDateTimeFieldSegment>,
): UseDateTimeFieldSegmentReturnValue {
  const context = useDateTimeFieldContext();
  const direction = useDirection();
  const isHydrating = useIsHydrating();
  const elementRef = shallowRef<HTMLInputElement | null>(null);
  const setFocused = useSetFieldFocused(context.disabled, elementRef, context.setFocused);

  const type = computed(() => toValue(segment).type);
  const view = computed(() => context.getView(type.value));

  // The digits that the user typed since the segment got the focus.
  let typedDigits = '';

  // During an IME composition, Safari gives the text through `input` events as a string that grows.
  // A commit of each value would take the text as typing of many digits. The segment thus buffers
  // the text and commits it one time at `compositionend`.
  const composingText = shallowRef<string | null>(null);

  const state = computed<DateTimeFieldSegmentState>(() => ({
    ...context.state.value,
    type: type.value,
    placeholder: view.value.number === undefined,
    index: toValue(segment).index,
  }));

  let ownElement: HTMLInputElement | null = null;

  function setElement(element: unknown) {
    const next = element as HTMLInputElement | null;
    // Vue calls a function ref again on each patch, with the same element.
    if (next === ownElement) {
      return;
    }
    if (ownElement) {
      context.unregisterSegment(ownElement);
    }
    if (next) {
      context.registerSegment(next);
    }
    ownElement = next;
    elementRef.value = next;
  }

  function moveFocus(delta: 1 | -1) {
    if (ownElement) {
      context.moveFocus(ownElement, delta);
    }
  }

  // Takes the characters of a text, and gives one change for the text. A segment that is full gets
  // no more characters, and the focus goes on to the next segment.
  function typeText(text: string, event: Event) {
    const segmentType = type.value;
    const details = createChangeEventDetails(REASONS.inputChange, event);
    let isFull = false;
    if (isNumericType(segmentType)) {
      const { min, max } = view.value;
      let number: number | undefined;
      for (const character of text) {
        const digit = digitOf(character, context.digits.value);
        if (digit !== undefined) {
          const typed = typeDigit(typedDigits, digit, { min, max });
          typedDigits = typed.digits;
          number = typed.number ?? number;
          isFull = typed.advance;
        }
        if (isFull) {
          break;
        }
      }
      if (number !== undefined) {
        context.setNumber(segmentType, number, details);
      }
    } else {
      let dayPeriod: DayPeriod | undefined;
      for (const character of text) {
        dayPeriod ??= dayPeriodOfLetter(character, context.dayPeriodTexts.value);
      }
      if (dayPeriod !== undefined) {
        context.setDayPeriod(dayPeriod, details);
        isFull = true;
      }
    }
    if (isFull) {
      moveFocus(1);
    }
  }

  // A removal takes the last digit. A segment that has no number goes back to the segment before
  // it when the removal is backward.
  function removeDigit(details: DateTimeFieldChangeEventDetails, isBackward: boolean) {
    const segmentType = type.value;
    const { number } = view.value;
    typedDigits = '';
    if (number === undefined) {
      if (isBackward) {
        moveFocus(-1);
      }
      return;
    }
    if (isNumericType(segmentType)) {
      context.setNumber(segmentType, removeLastDigit(number), details);
    } else {
      context.setDayPeriod(undefined, details);
    }
  }

  function spin(action: SegmentSpin, event: KeyboardEvent) {
    typedDigits = '';
    context.spin(type.value, action, createChangeEventDetails(REASONS.keyboard, event));
  }

  // The text that the user or the IME put in the input. The segment takes the digits after its own
  // text, or all digits when the text replaced it.
  function commitNativeText(actual: string, event: Event) {
    const expected = view.value.text;
    typeText(actual.startsWith(expected) ? actual.slice(expected.length) : actual, event);
  }

  // Vue writes `value` to the input only when it renders. A text that the user typed natively stays
  // in the input when the number does not change, so the segment writes its text again.
  function writeTextToInput() {
    const expected = composingText.value ?? view.value.text;
    if (ownElement && ownElement.value !== expected) {
      ownElement.value = expected;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    // A browser gives real key names, such as `Backspace`, to the keydown events of a composition.
    // The IME owns the edit until `compositionend`. `isComposing` is wrong in Safari:
    // https://bugs.webkit.org/show_bug.cgi?id=165004
    if (
      event.defaultPrevented ||
      context.disabled.value ||
      composingText.value !== null ||
      event.isComposing ||
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- The key code 229 is the IME workaround of Base UI, and the code keeps it.
      event.which === 229 ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    ) {
      return;
    }

    const isRtl = direction.value === 'rtl';
    const canChange = !context.readOnly.value;
    const segmentType = type.value;

    switch (event.key) {
      case 'ArrowLeft':
        moveFocus(isRtl ? 1 : -1);
        break;
      case 'ArrowRight':
        moveFocus(isRtl ? -1 : 1);
        break;
      case 'ArrowUp':
      case 'ArrowDown':
      case 'PageUp':
      case 'PageDown': {
        if (canChange) {
          const step =
            event.key.startsWith('Page') && isNumericType(segmentType)
              ? PAGE_STEPS[segmentType]
              : 1;
          spin(event.key.endsWith('Up') ? step : -step, event);
        }
        break;
      }
      case 'Home':
      case 'End':
        if (canChange) {
          spin(event.key === 'Home' ? 'min' : 'max', event);
        }
        break;
      case 'Backspace':
      case 'Delete':
        if (canChange) {
          removeDigit(createChangeEventDetails(REASONS.keyboard, event), event.key === 'Backspace');
        }
        break;
      default:
        return;
    }
    stopEvent(event);
  }

  // The text of the segment changes only through its number, so the segment takes each edit of
  // the browser and does not let it change the text. The IME gives edits that it cannot cancel.
  function handleBeforeinput(event: InputEvent) {
    if (
      composingText.value !== null ||
      event.isComposing ||
      event.inputType === 'insertCompositionText'
    ) {
      return;
    }
    event.preventDefault();
    if (context.disabled.value || context.readOnly.value) {
      return;
    }
    if (event.inputType === 'insertText') {
      typeText(event.data ?? '', event);
    } else if (event.inputType.startsWith('deleteContent')) {
      removeDigit(
        createChangeEventDetails(REASONS.inputClear, event),
        event.inputType === 'deleteContentBackward',
      );
    }
  }

  function handleInput(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    if (composingText.value !== null) {
      composingText.value = input.value;
      return;
    }
    if (!context.disabled.value && !context.readOnly.value) {
      const { inputType } = event as InputEvent;
      if (inputType?.startsWith('deleteContent')) {
        removeDigit(
          createChangeEventDetails(REASONS.inputClear, event),
          inputType === 'deleteContentBackward',
        );
      } else {
        commitNativeText(input.value, event);
      }
    }
    // The wait starts after the change, so that it ends after the flush of a parent that takes it.
    void nextTick(writeTextToInput);
  }

  function handlePaste(event: ClipboardEvent) {
    if (event.defaultPrevented || context.disabled.value || context.readOnly.value) {
      return;
    }
    let text: string;
    try {
      text = event.clipboardData?.getData('text/plain') ?? '';
    } catch {
      return;
    }
    event.preventDefault();
    context.pasteText(text, event);
  }

  watch(
    () => context.resetCount.value,
    () => {
      void nextTick(writeTextToInput);
    },
  );

  const props = computed(() => {
    const { number, text, placeholder, min, max, valueText, label, size, id } = view.value;
    return {
      id,
      type: 'text',
      role: 'spinbutton',
      inputmode: type.value === 'dayPeriod' ? 'text' : 'numeric',
      autocomplete: 'off',
      spellcheck: 'false',
      size,
      value: composingText.value ?? text,
      placeholder,
      'aria-label': label,
      'aria-valuenow': number,
      'aria-valuemin': min,
      'aria-valuemax': max,
      'aria-valuetext': valueText,
      'aria-required': context.required.value || undefined,
      'aria-invalid': !context.disabled.value && context.invalid.value ? true : undefined,
      disabled: context.disabled.value ? '' : undefined,
      readonly: context.readOnly.value || undefined,
      // The server can have another layout, and Vue writes no attribute while it hydrates.
      'data-allow-mismatch': isHydrating.value ? 'attribute' : undefined,
      onMousedown(event: MouseEvent) {
        if (event.defaultPrevented || context.disabled.value) {
          return;
        }
        // The browser would put the caret in the text. A segment selects its whole text.
        event.preventDefault();
        ownElement?.focus();
        ownElement?.select();
      },
      onFocusin(event: FocusEvent) {
        if (context.disabled.value) {
          return;
        }
        typedDigits = '';
        setFocused(true);
        (event.currentTarget as HTMLInputElement).select();
      },
      onFocusout(event: FocusEvent) {
        typedDigits = '';
        context.handleSegmentBlur(event);
      },
      onKeydown: handleKeydown,
      onBeforeinput: handleBeforeinput,
      onInput: handleInput,
      onPaste: handlePaste,
      onCompositionstart() {
        // Some Android keyboards report all text as a composition, so Android commits each `input`
        // event.
        if (!platform.os.android) {
          composingText.value = view.value.text;
        }
      },
      onCompositionend(event: CompositionEvent) {
        if (composingText.value === null) {
          return;
        }
        composingText.value = null;
        if (!context.disabled.value && !context.readOnly.value) {
          commitNativeText((event.currentTarget as HTMLInputElement).value, event);
        }
        void nextTick(writeTextToInput);
      },
    };
  });

  return { state, props, setElement };
}
