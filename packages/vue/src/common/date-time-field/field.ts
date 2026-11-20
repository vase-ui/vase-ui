import { inject, type InjectionKey } from 'vue';
import { fieldStateAttributes, type FieldState } from '../../field/control';
import type { ChangeEventDetails } from '../changeEventDetails';
import type { DayPeriod, EditableSegmentType, NumericSegmentType } from './layout';

export type DateTimeFieldGranularity = 'month' | 'day' | 'hour' | 'minute' | 'second';

/** An item of the layout. The user edits an item with `editable: true`. */
export type DateTimeFieldSegment =
  | { type: EditableSegmentType; editable: true }
  | { type: 'literal' | 'era' | 'timeZoneName'; editable: false; text: string };

export type DateTimeFieldChangeEventReason =
  'input-change' | 'input-clear' | 'input-paste' | 'keyboard' | 'clear-press';

export type DateTimeFieldChangeEventDetails = ChangeEventDetails<DateTimeFieldChangeEventReason>;

export interface DateTimeFieldState extends FieldState {
  /** No segment has a number. */
  empty: boolean;
  /** Each segment has a number, so the field has a value. */
  complete: boolean;
  disabled: boolean;
  readonly: boolean;
  required: boolean;
}

/**
 * The data attributes of the state, on the root, `Input` and `Literal`. Another part leaves out
 * each one that a CSS selector gives.
 */
export function stateAttributes(state: DateTimeFieldState) {
  const on = (flag: boolean) => (flag ? '' : undefined);
  return {
    ...fieldStateAttributes(state, state.disabled),
    'data-empty': on(state.empty),
    'data-complete': on(state.complete),
    'data-readonly': on(state.readonly),
    'data-required': on(state.required),
  };
}

/** What an editable segment shows. */
export interface SegmentView {
  /** `undefined` while the segment is empty. A day period is 0 or 1. */
  number: number | undefined;
  /** The text of the number, or an empty text. */
  text: string;
  placeholder: string;
  min: number;
  max: number;
  /** The name of a month or the text of a day period. */
  valueText: string | undefined;
  /** The name of the unit. */
  label: string;
  size: number;
}

/** A number is the amount of a step. `'min'` and `'max'` go to the ends of the range. */
export type SegmentSpin = number | 'min' | 'max';

/**
 * What the root of a field gives to its parts. The properties are reactive. Each action returns
 * `false` when a listener cancels its change.
 */
export interface DateTimeFieldForPart {
  readonly state: DateTimeFieldState;
  readonly segments: readonly DateTimeFieldSegment[];
  /** The `id` of the first segment. */
  readonly id: string;
  readonly invalid: boolean;
  /** The ten digits of the numbering system of the locale. */
  readonly digits: readonly string[];
  readonly dayPeriodTexts: Readonly<Record<DayPeriod, string>>;
  view(type: EditableSegmentType): SegmentView;
  setNumber(
    type: NumericSegmentType,
    number: number | undefined,
    details: DateTimeFieldChangeEventDetails,
  ): boolean;
  setDayPeriod(dayPeriod: DayPeriod | undefined, details: DateTimeFieldChangeEventDetails): boolean;
  spin(
    type: EditableSegmentType,
    spin: SegmentSpin,
    details: DateTimeFieldChangeEventDetails,
  ): void;
  paste(text: string, event: ClipboardEvent): void;
  clear(event: Event): void;
  /** Adds the element of a segment. Returns the function that removes it. */
  addSegment(element: HTMLInputElement, type: () => EditableSegmentType): () => void;
  /** Gives the focus to the segment after `from`, or before it for -1. */
  moveFocus(from: HTMLInputElement, step: 1 | -1): void;
  /** Gives the focus to the first empty segment, else to the first segment. */
  focusEmpty(): void;
}

export const dateTimeFieldKey: InjectionKey<DateTimeFieldForPart> = Symbol('date time field');

export function injectDateTimeField(): DateTimeFieldForPart {
  const field = inject(dateTimeFieldKey, null);
  if (!field) {
    throw new Error(
      'Vase UI: A part of a date or time field must be inside its root. Without a root the part has no value to show. Put the part inside <DateField.Root> or <TimeField.Root>.',
    );
  }
  return field;
}

/** What a picker part that renders a field root gives to the root. */
export interface DateTimeFieldHost {
  /** The `id` of the group, which `aria-labelledby` of the group can name. */
  groupId: string;
}

export const dateTimeFieldHostKey: InjectionKey<DateTimeFieldHost> = Symbol('date time field host');
