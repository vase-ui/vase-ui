import { onTestFinished, vi } from 'vitest';

/**
 * Makes `Intl.NumberFormat` use `locale` when no locale is passed, for the rest of the test.
 * Formatters are cached per locale and options, so format with options that no earlier test in
 * the file formatted without a locale. A `.node.test` file imports this function by a relative path
 * to `test/mockRuntimeLocale`.
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
