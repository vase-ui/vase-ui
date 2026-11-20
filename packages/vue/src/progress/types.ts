import type { HTMLAttributes } from 'vue';
import type { AsProps } from '../common/element';

export type ProgressStatus = 'indeterminate' | 'progressing' | 'complete';

export interface ProgressRootState {
  status: ProgressStatus;
}

export interface ProgressRootProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  /**
   * The value. With no value, `null` or a value that is not finite, the progress is indeterminate,
   * as a `<progress>` with no `value`. A value out of the range counts as the nearest end of the
   * range.
   * @default null
   */
  value?: number | null;
  /**
   * The value at the start of the range.
   * @default 0
   */
  min?: number;
  /**
   * The value at the end of the range.
   * @default 100
   */
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
   * the `value` prop. With no function, an indeterminate progress has no `aria-valuetext`, and a
   * screen reader says the state in the language of the user.
   */
  getAriaValueText?: (formattedValue: string, value: number | null) => string;
}

export interface ProgressLabelProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  /**
   * The progress bar names the label by this id in `aria-labelledby` from the mount on. To name the
   * bar in the server HTML too, give `Progress.Root` this id in `aria-labelledby`. An `id` in the
   * `element` slot does not name the bar.
   */
  id?: string;
}

export type ProgressLabelState = ProgressRootState;
export type ProgressValueState = ProgressRootState;
export type ProgressTrackState = ProgressRootState;
export type ProgressIndicatorState = ProgressRootState;

export interface ProgressValueProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface ProgressTrackProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface ProgressIndicatorProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}
