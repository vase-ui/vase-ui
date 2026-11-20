import type { HTMLAttributes } from 'vue';

export interface MeterRootProps extends /* @vue-ignore */ HTMLAttributes {
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

export interface MeterLabelProps extends /* @vue-ignore */ Omit<HTMLAttributes, 'id'> {
  id?: string;
}
