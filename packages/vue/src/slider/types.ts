import type { HTMLAttributes, LabelHTMLAttributes } from 'vue';
import type { ChangeEventDetails, GenericEventDetails } from '../common/changeEventDetails';
import type { AsProps } from '../common/element';
import type { FieldState } from '../field/control';
import type { ThumbCollisionBehavior } from './values';

export interface SliderRootProps<Value extends number | readonly number[] = number>
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /** The value. An array makes a range, with one value for each thumb. */
  modelValue?: Value;
  /** The first value of an uncontrolled slider. The default is `min`. */
  defaultValue?: Value;
  /**
   * The least value. The Home key sets it.
   * @default 0
   */
  min?: number;
  /**
   * The greatest value. The End key moves to the largest value of the grid.
   * @default 100
   */
  max?: number;
  /**
   * The distance between two values of the grid, which starts at `min`. An arrow key moves one
   * step. The slider shows a value of the parent at the nearest value of the grid.
   * @default 1
   */
  step?: number;
  /** The change for Page Up, Page Down, and Shift with an arrow key. @default 10 */
  largeStep?: number;
  /**
   * The least distance between two thumbs, as a number of steps. A thumb stops at its neighbour.
   * @default 0
   */
  minStepsBetweenValues?: number;
  /** What the thumbs do when a drag makes them meet. @default 'push' */
  thumbCollisionBehavior?: ThumbCollisionBehavior;
  /**
   * Where a thumb is at `min` and `max`: its centre at the end of the control, or its edge. CSS
   * places each thumb, also in the server HTML.
   * @default 'center'
   */
  thumbAlignment?: 'center' | 'edge';
  /**
   * The axis of the slider.
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical';
  /**
   * The user cannot change the value, and the form data has no value.
   * @default false
   */
  disabled?: boolean;
  /** The name of each input in the data of a form. The form gets one entry for each enabled thumb. */
  name?: string;
  /** The `id` of the form that owns the inputs, for a slider outside that form. */
  form?: string;
  /** The format of the text of `Slider.Value`, and of `aria-valuetext` of each input. */
  format?: Intl.NumberFormatOptions;
  /**
   * The locale of the text.
   * @default the locale of the nearest LocaleProvider, else 'en-US'
   */
  locale?: Intl.LocalesArgument;
}

export interface SliderRootState extends FieldState {
  disabled: boolean;
  dragging: boolean;
  orientation: 'horizontal' | 'vertical';
  /** The thumb whose input has the focus, or `-1`. */
  activeThumbIndex: number;
  /** The values as the slider shows them, in ascending order. */
  values: readonly number[];
  min: number;
  max: number;
  step: number;
  minStepsBetweenValues: number;
}

export type SliderThumbState = SliderRootState;
export type SliderLabelState = SliderRootState;
export type SliderValueState = SliderRootState;
export type SliderControlState = SliderRootState;
export type SliderTrackState = SliderRootState;
export type SliderIndicatorState = SliderRootState;

export type SliderRootChangeEventReason = 'input-change' | 'track-press' | 'drag' | 'keyboard';
export type SliderRootCommitEventReason = SliderRootChangeEventReason;

type Details<Reason extends SliderRootChangeEventReason, Native extends Event> = ChangeEventDetails<
  Reason,
  Native
> & {
  /** The thumb that moves. */
  activeThumbIndex: number;
};

export type SliderRootChangeEventDetails =
  | Details<'keyboard', KeyboardEvent>
  | Details<'track-press' | 'drag', PointerEvent>
  | Details<'input-change', Event>;

export type SliderRootCommitEventDetails =
  | GenericEventDetails<'keyboard', KeyboardEvent>
  | GenericEventDetails<'track-press' | 'drag', PointerEvent>
  | GenericEventDetails<'input-change'>;

export interface SliderControlProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface SliderTrackProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface SliderIndicatorProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface SliderThumbProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /**
   * The index of the value of the thumb. With none, the thumb takes its place among the thumbs.
   * Set it only when the thumbs do not render in the order of their values.
   */
  index?: number;
  /**
   * The user cannot move the thumb, and the form data has no value for it.
   * @default false
   */
  disabled?: boolean;
  /** The `id` of the input. */
  id?: string;
  /** Makes `aria-valuetext` of the input. */
  getAriaValueText?: (formattedValue: string, value: number, index: number) => string;
}

export interface SliderLabelProps extends /* @vue-ignore */ Omit<
  LabelHTMLAttributes,
  'for' | 'id'
> {
  /** The `id` of the label. With none, the label has an id of its own. */
  id?: string;
}
