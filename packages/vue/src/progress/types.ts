import type { HTMLAttributes } from 'vue';

export type ProgressStatus = 'indeterminate' | 'progressing' | 'complete';

export interface ProgressRootState {
  status: ProgressStatus;
}

export interface ProgressRootProps extends /* @vue-ignore */ HTMLAttributes {
  /**
   * The value. With no value, `null` or a value that is not finite, the progress is indeterminate,
   * as a `<progress>` with no `value`.
   */
  value?: number | null;
  min?: number;
  max?: number;
  /** The format of the text. With none, the text is the percent of the range. */
  format?: Intl.NumberFormatOptions;
  /** The locale of the text. Give the locale of the page: the server and the browser then agree. */
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
