import { inject } from 'vue';
import type { ComputedRef, InjectionKey, Ref } from 'vue';
import type { VaseUIChangeEventDetails } from '../../createVaseUIEventDetails';
import type { FieldRootState } from '../../field-root-context/FieldRootContext';
import type { REASONS } from '../../reasons';
import type { DayPeriod, EditableSegmentType, NumericSegmentType } from './segmentLayout';

export type DateTimeFieldChangeEventReason =
  | typeof REASONS.inputChange
  | typeof REASONS.inputClear
  | typeof REASONS.inputPaste
  | typeof REASONS.keyboard
  | typeof REASONS.clearPress
  | typeof REASONS.none;
export type DateTimeFieldChangeEventDetails =
  VaseUIChangeEventDetails<DateTimeFieldChangeEventReason>;

export interface DateTimeFieldRootState extends FieldRootState {
  readOnly: boolean;
  required: boolean;
  /** Whether no segment has a number. */
  empty: boolean;
  /** Whether each segment has a number, so that the field has a value. */
  complete: boolean;
  invalid: boolean;
}

/** An element of a layout. A part shows each one: an `input` for a segment that the user edits. */
export type DateTimeFieldSegment =
  | { type: EditableSegmentType; index: number; editable: true }
  | { type: 'literal' | 'era' | 'timeZoneName'; index: number; editable: false; text: string };

/** What an editable segment shows and what it tells to a screen reader. */
export interface DateTimeFieldSegmentView {
  /** The number of the segment, or `undefined` while the segment is empty. A day period is 0 or 1. */
  number: number | undefined;
  /** The text of the number, or an empty text while the segment is empty. */
  text: string;
  placeholder: string;
  min: number;
  max: number;
  valueText: string | undefined;
  label: string;
  /** The greatest length of the text of the segment. */
  size: number;
  id: string | undefined;
}

/** A number is the amount of a step. `'min'` and `'max'` go to the least and the greatest number. */
export type SegmentSpin = number | 'min' | 'max';

export interface DateTimeFieldContext {
  state: ComputedRef<DateTimeFieldRootState>;
  segments: ComputedRef<DateTimeFieldSegment[]>;
  /**
   * Changes when the layout of the server differs from the layout of the browser. A part puts it
   * in the `key` of each segment, so that Vue makes the elements again.
   */
  listKey: Readonly<Ref<number>>;
  disabled: ComputedRef<boolean>;
  readOnly: ComputedRef<boolean>;
  required: ComputedRef<boolean>;
  invalid: ComputedRef<boolean>;
  /**
   * Counts the resets of the form. A reset puts the browser default in each input, and Vue writes
   * `value` only when it changes. A part writes its text again after each reset.
   */
  resetCount: Readonly<Ref<number>>;
  /** The ten digits of the numbering system of the locale. */
  digits: ComputedRef<string[]>;
  dayPeriodTexts: ComputedRef<Record<DayPeriod, string>>;
  getView: (type: EditableSegmentType) => DateTimeFieldSegmentView;
  setNumber: (
    type: NumericSegmentType,
    number: number | undefined,
    details: DateTimeFieldChangeEventDetails,
  ) => void;
  setDayPeriod: (
    dayPeriod: DayPeriod | undefined,
    details: DateTimeFieldChangeEventDetails,
  ) => void;
  spin: (
    type: EditableSegmentType,
    spin: SegmentSpin,
    details: DateTimeFieldChangeEventDetails,
  ) => void;
  pasteText: (text: string, event: ClipboardEvent) => void;
  /** Gives the focus to the segment after `from`, or to the segment before it when `direction` is -1. */
  moveFocus: (from: HTMLInputElement, direction: 1 | -1) => void;
  registerSegment: (element: HTMLInputElement, getType: () => EditableSegmentType) => () => void;
  /** A part that shows a literal, an era or a time zone name gives its element and its place in the layout. */
  registerLiteral: (element: HTMLElement, index: number) => void;
  unregisterLiteral: (element: HTMLElement) => void;
  setFocused: (focused: boolean) => void;
  /** A press on the `Input` outside a segment gives the focus to the first empty segment, else to the first segment. */
  handleInputPress: (event: MouseEvent) => void;
  /** The part gives it to the `ref` of its element. */
  setRootElement: (element: unknown) => void;
  /** The element that the root part exposes as `inputElement`. */
  hiddenInputElement: Readonly<Ref<HTMLInputElement | null>>;
  /** The sets of props of the root element in merge order. The part gives the function to `useRenderElement` as `props`. */
  getRootProps: (attrs: Record<string, any>) => Record<string, any>[];
  hiddenInputProps: () => Record<string, unknown>;
  clear: (event?: MouseEvent | KeyboardEvent) => void;
}

export const DateTimeFieldContext: InjectionKey<DateTimeFieldContext> = Symbol();

export function useDateTimeFieldContext(): DateTimeFieldContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(DateTimeFieldContext, undefined);

  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of a date or time field must be inside its root. Without a root the part has no value to show. Put the part inside <DateField.Root> or <TimeField.Root>.',
    );
  }

  return context;
}

/**
 * What a part that renders a field root gives to the root, such as a field of a range picker. The
 * root has no prop for it, because the `id` prop of a root is the id of its first segment.
 */
export interface DateTimeFieldHost {
  /**
   * The `id` of the group element of the root. The part names the group by that `id`, so that the
   * name of the group holds the `aria-label` of the group and a label.
   */
  groupId: string;
}

export const DateTimeFieldHostContext: InjectionKey<DateTimeFieldHost> = Symbol();

/**
 * The count of the native resets that a picker put back to its default value.
 * `useDateTimePickerRoot` provides it to the field roots below the picker. The picker gives the new
 * value of a reset to such a root with the next render, so the root reads the count to tell that
 * value from the value of a user.
 */
export const PickerResetCountContext: InjectionKey<Readonly<Ref<number>>> = Symbol();
