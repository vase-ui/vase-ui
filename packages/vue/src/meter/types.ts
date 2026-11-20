import type { HTMLAttributes } from 'vue';
import type { AsProps } from '../common/element';

export interface MeterRootProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {
  value: number;
  /** @default 0 */
  min?: number;
  /** @default 100 */
  max?: number;
  /** The options of `Intl.NumberFormat` for the text. With none, the text is a percent of the range. */
  format?: Intl.NumberFormatOptions;
  /**
   * The locale of the text.
   * @default the locale of the nearest LocaleProvider, else 'en-US'
   */
  locale?: Intl.LocalesArgument;
  /** Gives `aria-valuetext` from the text and the `value` prop. */
  getAriaValueText?: (formattedValue: string, value: number) => string;
}

export interface MeterLabelProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as' | 'id'> {
  id?: string;
}

export interface MeterValueProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface MeterTrackProps extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}

export interface MeterIndicatorProps
  extends AsProps, /* @vue-ignore */ Omit<HTMLAttributes, 'as'> {}
