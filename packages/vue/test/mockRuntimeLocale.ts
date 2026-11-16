import { onTestFinished, vi } from 'vitest';

/**
 * Makes `Intl.NumberFormat` use `locale` when no locale is passed, for the rest of the test.
 * Formatters are cached per locale and options, so format with options that no earlier test in
 * the file formatted without a locale. A `.node.test` file imports this function and
 * `mockRuntimeDateTimeLocale` by a relative path to `test/mockRuntimeLocale`.
 */
export function mockRuntimeLocale(locale: string) {
  const NumberFormat = Intl.NumberFormat;
  const numberFormatSpy = vi
    .spyOn(Intl, 'NumberFormat')
    .mockImplementation(function MockNumberFormat(requestedLocale, options) {
      return new NumberFormat(requestedLocale ?? locale, options);
    });
  onTestFinished(() => numberFormatSpy.mockRestore());
}

/**
 * Makes `Intl.DateTimeFormat` use `locale` when no locale is passed, for the rest of the test. A
 * date part with no `locale` then reads the names, the hour cycle and the week of `locale` after
 * the mount.
 */
export function mockRuntimeDateTimeLocale(locale: string) {
  const DateTimeFormat = Intl.DateTimeFormat;
  const dateTimeFormatSpy = vi
    .spyOn(Intl, 'DateTimeFormat')
    .mockImplementation(function MockDateTimeFormat(requestedLocale, options) {
      return new DateTimeFormat(requestedLocale ?? locale, options);
    });
  onTestFinished(() => dateTimeFormatSpy.mockRestore());
}
