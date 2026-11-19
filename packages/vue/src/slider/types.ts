import type { HTMLAttributes, LabelHTMLAttributes } from 'vue';
import type { ChangeEventDetails } from '../common/changeEventDetails';
import type { FieldState } from '../field/control';
import type { ThumbCollisionBehavior } from './values';

export interface SliderRootProps<
  Value extends number | readonly number[] = number,
> extends /* @vue-ignore */ HTMLAttributes {
  /** The value. An array makes a range, with one value for each thumb. */
  modelValue?: Value;
  /** The first value of an uncontrolled slider. The default is `min`. */
  defaultValue?: Value;
  /** @default 0 */
  min?: number;
  /** @default 100 */
  max?: number;
  /** The grid of values starts at `min`. @default 1 */
  step?: number;
  /** The change for Page Up, Page Down, and Shift with an arrow key. @default 10 */
  largeStep?: number;
  /** The least distance between two thumbs, as a number of steps. @default 0 */
  minStepsBetweenValues?: number;
  /** What the thumbs do when a drag makes them meet. @default 'push' */
  thumbCollisionBehavior?: ThumbCollisionBehavior;
  /**
   * Where a thumb is at `min` and `max`: its centre at the end of the control, or its edge.
   * @default 'center'
   */
  thumbAlignment?: 'center' | 'edge';
  /** @default 'horizontal' */
  orientation?: 'horizontal' | 'vertical';
  disabled?: boolean;
  /** The name of each input in the data of a form. */
  name?: string;
  /** The `id` of the form that owns the inputs, for a slider outside that form. */
  form?: string;
  /** The format of the value as text. */
  format?: Intl.NumberFormatOptions;
  /** The locale of the text. Give the locale of the page. @default 'en-US' */
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

type Details<Reason extends SliderRootChangeEventReason, Native extends Event> = Omit<
  ChangeEventDetails<Reason>,
  'event'
> & {
  event: Native;
  /** The thumb that moves. */
  activeThumbIndex: number;
};

export type SliderRootChangeEventDetails =
  | Details<'keyboard', KeyboardEvent>
  | Details<'track-press' | 'drag', PointerEvent>
  | Details<'input-change', Event>;

export type SliderRootCommitEventDetails =
  | { reason: 'keyboard'; event: KeyboardEvent }
  | { reason: 'track-press' | 'drag'; event: PointerEvent }
  | { reason: 'input-change'; event: Event };

export interface SliderThumbProps extends /* @vue-ignore */ HTMLAttributes {
  /**
   * The index of the value of the thumb. With none, the thumb takes its place among the thumbs.
   * Set it only when the thumbs do not render in the order of their values.
   */
  index?: number;
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
  id?: string;
}
