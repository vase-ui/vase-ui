import type { HTMLAttributes } from 'vue';

export type ProgressStatus = 'indeterminate' | 'progressing' | 'complete';

export interface ProgressRootState {
  status: ProgressStatus;
}

export interface ProgressRootProps extends /* @vue-ignore */ HTMLAttributes {
  /**
   * The value. With no value, `null` or a value that is not finite, the progress is indeterminate,
   * as a `<progress>` with no `value`.
   * @default null
   */
  value?: number | null;
  /** @default 0 */
  min?: number;
  /** @default 100 */
  max?: number;
  /** The format of the text. With none, the text is the percent of the range. */
  format?: Intl.NumberFormatOptions;
  /**
   * The locale of the text.
   * @default the locale of the nearest LocaleProvider, else 'en-US'
   */
  locale?: Intl.LocalesArgument;
  /**
   * Makes `aria-valuetext` from the text, which is `''` while the progress is indeterminate, and
   * the `value` prop.
   */
  getAriaValueText?: (formattedValue: string, value: number | null) => string;
}

export interface ProgressLabelProps extends /* @vue-ignore */ Omit<HTMLAttributes, 'id'> {
  id?: string;
}

export type ProgressLabelState = ProgressRootState;
export type ProgressValueState = ProgressRootState;
export type ProgressTrackState = ProgressRootState;
export type ProgressIndicatorState = ProgressRootState;
