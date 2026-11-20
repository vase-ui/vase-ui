import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes } from 'vue';
import type { ChangeEventDetails, GenericEventDetails } from '../common/changeEventDetails';
import type { AsProps } from '../common/element';
import type { FieldState } from '../field/control';

export interface NumberFieldRootProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /** The value. `null` is an empty field, and `NaN` counts as `null`. */
  modelValue?: number | null;
  /** The first value of a field with no `modelValue`. */
  defaultValue?: number;
  min?: number;
  max?: number;
  /**
   * The amount of one step. A number is also the `step` of the hidden input, so the form accepts
   * only its multiples from `min`. With none, or `'any'`, a step is 1 and the form accepts each
   * number.
   */
  step?: number | 'any';
  /**
   * The amount of one step with the Alt key.
   * @default 0.1
   */
  smallStep?: number;
  /**
   * The amount of one step with the Shift key.
   * @default 10
   */
  largeStep?: number;
  /**
   * A step gives a multiple of its amount, counted from `min`, or from 0 with no `min`.
   * @default false
   */
  snapOnStep?: boolean;
  /**
   * A typed, pasted or filled number stays out of the range, so the form reports it. A step
   * always stays in the range.
   * @default false
   */
  allowOutOfRange?: boolean;
  /**
   * The wheel steps the value while the input has the focus.
   * @default false
   */
  allowWheelScrub?: boolean;
  /** The options of `Intl.NumberFormat` for the text. */
  format?: Intl.NumberFormatOptions;
  /**
   * The locale of the text.
   * @default the locale of the nearest LocaleProvider, else 'en-US'
   */
  locale?: Intl.LocalesArgument;
  /** The name of the value in the form data. The name of a `Field.Root` wins. */
  name?: string;
  /** The `id` of the form that owns the inputs. */
  form?: string;
  /** @default false */
  required?: boolean;
  /** @default false */
  disabled?: boolean;
  /** @default false */
  readonly?: boolean;
}

export interface NumberFieldRootState extends FieldState {
  value: number | null;
  /** The text of the input. */
  inputValue: string;
  required: boolean;
  disabled: boolean;
  readonly: boolean;
  /** A scrub area of the field is in a scrub. */
  scrubbing: boolean;
}

export type NumberFieldRootChangeEventReason =
  | 'input-change'
  | 'input-clear'
  | 'input-blur'
  | 'input-paste'
  | 'keyboard'
  | 'increment-press'
  | 'decrement-press'
  | 'wheel'
  | 'scrub'
  | 'none';

type Details<
  Reason extends NumberFieldRootChangeEventReason,
  Of extends Event,
> = ChangeEventDetails<Reason, Of> & {
  /** `1` or `-1` for a step from a number. */
  direction?: 1 | -1;
};

export type NumberFieldRootChangeEventDetails =
  | Details<'input-change' | 'input-clear', InputEvent | Event>
  | Details<'input-paste', InputEvent>
  | Details<'input-blur', FocusEvent>
  | Details<'keyboard', KeyboardEvent>
  | Details<'increment-press' | 'decrement-press', PointerEvent | MouseEvent>
  | Details<'wheel', WheelEvent>
  | Details<'scrub', PointerEvent>
  | Details<'none', Event>;

export type NumberFieldRootCommitEventDetails =
  | GenericEventDetails<'input-clear' | 'input-blur', FocusEvent>
  | GenericEventDetails<'keyboard', KeyboardEvent>
  | GenericEventDetails<'increment-press' | 'decrement-press', PointerEvent | MouseEvent>
  | GenericEventDetails<'wheel', WheelEvent>
  | GenericEventDetails<'scrub', PointerEvent>
  | GenericEventDetails<'none'>;

export type NumberFieldRootCommitEventReason = NumberFieldRootCommitEventDetails['reason'];

export interface NumberFieldGroupProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}
export type NumberFieldGroupState = NumberFieldRootState;

// The type of `autocomplete` in `InputHTMLAttributes` is a union that is too large for vue-tsc.
type InputAttributes = Omit<InputHTMLAttributes, 'autocomplete' | 'id'> & {
  autocomplete?: string | null | undefined;
};

export interface NumberFieldInputProps extends /* @vue-ignore */ InputAttributes {
  /** The `id` of the input. With none, the input has the id of its `Field.Root`. */
  id?: string;
}
export type NumberFieldInputState = NumberFieldRootState;

export interface NumberFieldIncrementProps
  extends AsProps, /* @vue-ignore */ Omit<ButtonHTMLAttributes, 'as' | 'disabled'> {
  /** @default false */
  disabled?: boolean;
}
/** `disabled` is also true for the `disabled` prop of the button and at the bound. */
export type NumberFieldIncrementState = NumberFieldRootState;

export interface NumberFieldDecrementProps
  extends AsProps, /* @vue-ignore */ Omit<ButtonHTMLAttributes, 'as' | 'disabled'> {
  /** @default false */
  disabled?: boolean;
}
/** `disabled` is also true for the `disabled` prop of the button and at the bound. */
export type NumberFieldDecrementState = NumberFieldRootState;

export interface NumberFieldScrubAreaProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /**
   * The axis of the pointer that steps the value.
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical';
  /**
   * The distance of the pointer, in px, for one step.
   * @default 2
   */
  pixelSensitivity?: number;
}
export type NumberFieldScrubAreaState = NumberFieldRootState;
