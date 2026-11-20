import { expect, describe, it } from 'vitest';
import { createNumberText } from './text';

/** The number of `text` in the locale and the format. */
function parseNumber(
  text: string,
  locale: Intl.LocalesArgument = 'en-US',
  format?: Intl.NumberFormatOptions,
) {
  return createNumberText(locale, format).parse(text);
}

describe('the number of a text', () => {
  describe('parse', () => {
    it('parses a number', () => {
      const numberString = new Intl.NumberFormat('en-US').format(1234.56);
      expect(parseNumber(numberString)).toBe(1234.56);
    });

    it('parses percentages by default', () => {
      expect(parseNumber('12%')).toBe(0.12);
    });

    it('parses a number with Arabic numerals', () => {
      expect(parseNumber('١٬٢٣٤٫٥٦')).toBe(1234.56);
    });

    it('parses a number with Han numerals', () => {
      expect(parseNumber('一,二三四.五六')).toBe(1234.56);
    });

    it('parses percentages with Arabic numerals', () => {
      expect(parseNumber('١٢٪')).toBe(0.12);
    });

    it('parses percentages with Han numerals', () => {
      expect(parseNumber('一二%')).toBe(0.12);
    });

    it('gives undefined for text that is not a number', () => {
      expect(parseNumber('invalid')).toBe(undefined);
    });

    it('handles percentages with style: "percent"', () => {
      expect(parseNumber('12%', 'en-US', { style: 'percent' })).toBe(0.12);
    });

    it('parses prefix percentages', () => {
      const format = { style: 'percent', maximumFractionDigits: 2 } as const;
      const formatted = new Intl.NumberFormat('tr-TR', format).format(0.0123);

      expect(parseNumber(formatted, 'tr-TR', format)).toBe(0.0123);
    });

    it('parses scientific notation percentages', () => {
      expect(parseNumber('1e-7%', 'en-US', { style: 'percent' })).toBe(1e-9);
    });

    it('handles percentages with style: "unit" and unit: "percent"', () => {
      expect(parseNumber('12%', 'en-US', { style: 'unit', unit: 'percent' })).toBe(12);
      // The long label is a word, so the typed `%` is the only percent sign left
      expect(
        parseNumber('12%', 'en-US', { style: 'unit', unit: 'percent', unitDisplay: 'long' }),
      ).toBe(12);
    });

    it('strips an interleaved percent sign (1%2)', () => {
      expect(parseNumber('1%2', 'en-US', { style: 'percent' })).toBe(0.12);
      expect(parseNumber('1%2', 'en-US', { style: 'unit', unit: 'percent' })).toBe(12);
    });

    it('parses fullwidth digits and punctuation', () => {
      expect(parseNumber('１，２３４．５６')).toBe(1234.56);
      expect(parseNumber('１２％')).toBe(0.12);
    });

    it('parses Persian digits', () => {
      expect(parseNumber('۱۲۳۴')).toBe(1234);
      expect(parseNumber('۱۲٫۳۴')).toBe(12.34);
      expect(parseNumber('۱۲٪')).toBe(0.12);
    });

    it('parses Persian digits with Arabic thousands and decimal characters', () => {
      // Uses Persian digits + Arabic separators (common in copied text)
      expect(parseNumber('۱۲٬۳۴۵٫۶۷')).toBe(12345.67);
    });

    it('parses permille values', () => {
      expect(parseNumber('12‰')).toBe(0.012);
      expect(parseNumber('12؉')).toBe(0.012);
    });

    it('strips bidi/control characters', () => {
      expect(parseNumber('1\u200E234.56')).toBe(1234.56);
      expect(parseNumber('\u200E12\u200F%')).toBe(0.12);
    });

    it('handles unicode minus and plus signs', () => {
      expect(parseNumber('−1234')).toBe(-1234);
      expect(parseNumber('1234−')).toBe(-1234);
      expect(parseNumber('＋1234')).toBe(1234);
      expect(parseNumber('1234＋')).toBe(1234);
    });

    it('parses french formatted numbers with narrow no-break space grouping', () => {
      const fr = new Intl.NumberFormat('fr-FR').format(1234.5); // e.g., '1 234,5'
      expect(parseNumber(fr, 'fr-FR')).toBe(1234.5);
      expect(parseNumber(`${fr}−`, 'fr-FR')).toBe(-1234.5);
    });

    it('parses currency when options specify currency style', () => {
      expect(parseNumber('$1,234.56', 'en-US', { style: 'currency', currency: 'USD' })).toBe(
        1234.56,
      );
    });

    it('parses scientific notation with currency codes', () => {
      const format = {
        style: 'currency',
        currency: 'EUR',
        currencyDisplay: 'code',
        notation: 'scientific',
        maximumFractionDigits: 2,
      } as const;
      const formatted = new Intl.NumberFormat('en-US', format).format(12345);

      expect(parseNumber(formatted, 'en-US', format)).toBe(12300);
    });

    it.each(['ar-EG', 'fa-IR'] as const)(
      'parses localized scientific notation for %s',
      (locale) => {
        const format = { notation: 'scientific', maximumFractionDigits: 2 } as const;
        const formatted = new Intl.NumberFormat(locale, format).format(12345);

        expect(parseNumber(formatted, locale, format)).toBe(12300);
      },
    );

    it.each(['ar-EG', 'fa-IR'] as const)(
      'parses localized percent scientific notation with a negative exponent for %s',
      (locale) => {
        const format = {
          style: 'percent',
          notation: 'scientific',
          maximumFractionDigits: 2,
        } as const;
        const value = 0.0000012345;
        const formatted = new Intl.NumberFormat(locale, format).format(value);

        expect(parseNumber(formatted, locale, format)).toBe(0.00000123);
      },
    );

    it.each(['ar-EG', 'fa-IR'] as const)(
      'parses localized tiny percent scientific notation for %s',
      (locale) => {
        const format = {
          style: 'percent',
          notation: 'scientific',
          maximumFractionDigits: 2,
        } as const;
        const value = 0.0000000000012345;
        const formatted = new Intl.NumberFormat(locale, format).format(value);

        expect(parseNumber(formatted, locale, format)).toBe(0.00000000000123);
      },
    );

    it('parses a localized exponent separator typed with ASCII digits', () => {
      const format = { notation: 'scientific' } as const;
      // The fa-IR separator is `×۱۰^`, with Persian digits
      expect(parseNumber('1.235×10^3', 'fa-IR', format)).toBe(1235);
    });

    it('parses scientific notation permille values', () => {
      expect(parseNumber('1e-7‰', 'en-US')).toBe(1e-10);
    });

    it('parses units when options specify unit style', () => {
      expect(parseNumber('12 kg', 'en-US', { style: 'unit', unit: 'kilogram' })).toBe(12);
    });

    it('gives undefined for Infinity-like inputs', () => {
      expect(parseNumber('Infinity')).toBe(undefined);
      expect(parseNumber('-Infinity')).toBe(undefined);
      expect(parseNumber('∞')).toBe(undefined);
    });

    it('gives undefined when parsing overflows to Infinity', () => {
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'percent',
        maximumFractionDigits: 2,
      }).format(Number.MAX_VALUE);

      expect(parseNumber(formatted, 'en-US', { style: 'percent' })).toBe(undefined);
    });

    it.each([
      { name: 'groups of one digit', text: '1.2.3' },
      { name: 'a first group of four digits', text: '1234.567.89' },
      { name: 'a middle group of two digits', text: '12.34.567' },
      { name: 'a middle group of four digits', text: '1.2345.67' },
      { name: 'a short group after a group of three', text: '1.234.5.6' },
      { name: 'an empty first group', text: '.234.5' },
      { name: 'a minus sign before the text', text: '-1.2.3' },
      { name: 'a percent sign after the text', text: '1.2.3%' },
    ])('BUG-5424: gives undefined for dots that are not group separators: $name', ({ text }) => {
      expect(parseNumber(text)).toBe(undefined);
      expect(parseNumber(text, 'en-US')).toBe(undefined);
    });

    it('BUG-5424: reads dots that are group separators', () => {
      expect(parseNumber('1.234.5')).toBe(1234.5);
      expect(parseNumber('12.345.678.9')).toBe(12345678.9);
      expect(parseNumber('-123.456.789.01')).toBe(-123456789.01);
      expect(parseNumber('1.234.567.89e2')).toBe(123456789);
      // A sign after the label is still in the text when the check runs
      const usd = { style: 'currency', currency: 'USD' } as const;
      expect(parseNumber('$-1.234.567.89', 'en-US', usd)).toBe(-1234567.89);
      expect(parseNumber('$+1.234.567.89', 'en-US', usd)).toBe(1234567.89);
    });

    it('BUG-5424: applies the rule to the decimal separator of the locale', () => {
      expect(parseNumber('1,2,3', 'de-DE')).toBe(undefined);
      expect(parseNumber('1,,5', 'de-DE')).toBe(1.5);
      expect(parseNumber('1.234.567,89', 'de-DE')).toBe(1234567.89);
    });

    it('collapses extra dots from mixed-locale inputs', () => {
      // Last '.' is decimal; previous '.' are removed
      expect(parseNumber('1.234.567.89')).toBe(1234567.89);
    });

    it('parses number with mixed separators (FR)', () => {
      expect(parseNumber('1.234.567,89', 'fr-FR')).toBe(1234567.89);
    });

    it('parses number with mixed separators (US)', () => {
      expect(parseNumber('1.234.567,89', 'en-US')).toBe(1234.56789);
    });

    it('gives null for empty and whitespace-only input', () => {
      expect(parseNumber('')).toBe(null);
      expect(parseNumber('   ')).toBe(null);
    });

    it('gives undefined for just a sign', () => {
      expect(parseNumber('-')).toBe(undefined);
      expect(parseNumber('+')).toBe(undefined);
    });

    it('handles ASCII leading and trailing signs', () => {
      expect(parseNumber('+1234')).toBe(1234);
      expect(parseNumber('1234+')).toBe(1234);
      expect(parseNumber('-1234')).toBe(-1234);
      expect(parseNumber('1234-')).toBe(-1234);
    });

    it('supports multiple unicode minus variants', () => {
      expect(parseNumber('‒123')).toBe(-123); // figure dash
      expect(parseNumber('–123')).toBe(-123); // en dash
      expect(parseNumber('—123')).toBe(-123); // em dash
      expect(parseNumber('－123')).toBe(-123); // fullwidth hyphen-minus
      expect(parseNumber('﹣123')).toBe(-123); // small hyphen-minus
    });

    it('supports additional unicode plus variants', () => {
      expect(parseNumber('﹢123')).toBe(123); // small plus sign
    });

    it('handles additional percent symbol variants', () => {
      expect(parseNumber('12％')).toBe(0.12); // fullwidth percent
      expect(parseNumber('12﹪')).toBe(0.12); // small percent
      expect(parseNumber('12٪')).toBe(0.12); // Arabic percent sign with ASCII digits
    });

    it('parses Arabic punctuation with ASCII digits', () => {
      expect(parseNumber('1٬234٫56')).toBe(1234.56);
    });

    it('removes various Unicode space groupings (fr-FR)', () => {
      expect(parseNumber('1\u202F234,56', 'fr-FR')).toBe(1234.56); // narrow no-break space
      expect(parseNumber('1\u2009234,56', 'fr-FR')).toBe(1234.56); // thin space
      expect(parseNumber('1\u2007234,56', 'fr-FR')).toBe(1234.56); // figure space
      expect(parseNumber('1\u00A0234,56', 'fr-FR')).toBe(1234.56); // no-break space
    });

    it('handles Swiss grouping apostrophe', () => {
      // de-CH uses RIGHT SINGLE QUOTATION MARK (U+2019) as group separator on some platforms and straight apostrophe on others
      expect(parseNumber('1’234.56', 'de-CH')).toBe(1234.56);
      expect(parseNumber("1'234.56", 'de-CH')).toBe(1234.56);
    });

    it('parses de-DE formatted numbers', () => {
      expect(parseNumber('1.234,56', 'de-DE')).toBe(1234.56);
      expect(parseNumber('1.234.567,89', 'de-DE')).toBe(1234567.89);
    });

    it('parses currency prefix/suffix across locales', () => {
      const en = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(
        1234.56,
      );
      const fr = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
        1234.56,
      );
      expect(parseNumber(en, 'en-US', { style: 'currency', currency: 'EUR' })).toBe(1234.56);
      expect(parseNumber(fr, 'fr-FR', { style: 'currency', currency: 'EUR' })).toBe(1234.56);
    });

    it.each([
      { name: 'pt-BR BRL', locale: 'pt-BR', format: { style: 'currency', currency: 'BRL' } },
      { name: 'pt-BR USD', locale: 'pt-BR', format: { style: 'currency', currency: 'USD' } },
      { name: 'pt-BR EUR', locale: 'pt-BR', format: { style: 'currency', currency: 'EUR' } },
      { name: 'en-US CHF', locale: 'en-US', format: { style: 'currency', currency: 'CHF' } },
      { name: 'eu-ES percent', locale: 'eu-ES', format: { style: 'percent' } },
    ] as const)('parses a prefix symbol followed by a space ($name)', ({ locale, format }) => {
      const formatter = new Intl.NumberFormat(locale, format);
      const value = format.style === 'percent' ? 0.14 : 13.5;

      expect(parseNumber(formatter.format(value), locale, format)).toBe(value);
      expect(parseNumber(formatter.format(-value), locale, format)).toBe(-value);
    });

    it('parses typed negatives with a spaced prefix symbol', () => {
      const brl = { style: 'currency', currency: 'BRL' } as const;
      expect(parseNumber('-R$ 14,00', 'pt-BR', brl)).toBe(-14);
      expect(parseNumber('-R$\u00a014,00', 'pt-BR', brl)).toBe(-14);
      expect(parseNumber('-R$ 1.234,567', 'pt-BR', brl)).toBe(-1234.567);
      expect(parseNumber('R$ 1.234,567', 'pt-BR', brl)).toBe(1234.567);
      expect(parseNumber('-US$ 13,00', 'pt-BR', { style: 'currency', currency: 'USD' })).toBe(-13);
      expect(parseNumber('-€ 13', 'pt-BR', { style: 'currency', currency: 'EUR' })).toBe(-13);
      expect(parseNumber('-CHF 13.50', 'en-US', { style: 'currency', currency: 'CHF' })).toBe(
        -13.5,
      );
      expect(parseNumber('−% 14', 'eu-ES', { style: 'percent' })).toBe(-0.14);
      expect(parseNumber('−%\u202f14', 'eu-ES', { style: 'percent' })).toBe(-0.14);
    });

    it.each([
      { name: 'pl-PL celsius', locale: 'pl-PL', unit: 'celsius' },
      { name: 'pl-PL hour', locale: 'pl-PL', unit: 'hour' },
      { name: 'pl-PL week', locale: 'pl-PL', unit: 'week' },
      { name: 'fr-FR week', locale: 'fr-FR', unit: 'week' },
      { name: 'de-CH hour', locale: 'de-CH', unit: 'hour' },
      { name: 'da-DK month', locale: 'da-DK', unit: 'month' },
      { name: 'ru-RU yard', locale: 'ru-RU', unit: 'yard' },
      { name: 'ru-RU fluid-ounce', locale: 'ru-RU', unit: 'fluid-ounce' },
      { name: 'en-US kilometer-per-hour', locale: 'en-US', unit: 'kilometer-per-hour' },
      { name: 'en-US mile-per-hour', locale: 'en-US', unit: 'mile-per-hour' },
    ] as const)('parses an abbreviated unit label ($name)', ({ locale, unit }) => {
      const format = { style: 'unit', unit } as const;
      const formatter = new Intl.NumberFormat(locale, format);

      [1, 2, 5, 21.5, -21.5, 1234.5].forEach((value) => {
        expect(parseNumber(formatter.format(value), locale, format)).toBe(value);
      });
    });

    it('parses typed values with a period in the unit label', () => {
      const celsius = { style: 'unit', unit: 'celsius' } as const;
      expect(parseNumber('21,7 st. C', 'pl-PL', celsius)).toBe(21.7);
      expect(parseNumber('-21,7 st. C', 'pl-PL', celsius)).toBe(-21.7);
      expect(parseNumber('21,7 st.', 'pl-PL', celsius)).toBe(21.7);
      expect(parseNumber('2,5 sem.', 'fr-FR', { style: 'unit', unit: 'week' })).toBe(2.5);
    });

    // The numbering system is pinned because engines disagree on some locales' defaults (WebKit
    // formats bn-BD with Latin digits, Chromium formats my-MM with Latin digits)
    it.each([
      { name: 'bn-BD', locale: 'bn-BD-u-nu-beng' },
      { name: 'as-IN', locale: 'as-IN-u-nu-beng' },
      { name: 'mr-IN', locale: 'mr-IN-u-nu-deva' },
      { name: 'ne-NP', locale: 'ne-NP-u-nu-deva' },
      { name: 'my-MM', locale: 'my-MM-u-nu-mymr' },
      { name: 'dz-BT', locale: 'dz-BT-u-nu-tibt' },
      { name: 'en-US with Thai digits', locale: 'en-US-u-nu-thai' },
    ])('parses the digits of the locale numbering system ($name)', ({ locale }) => {
      const percent = { style: 'percent', maximumFractionDigits: 1 } as const;
      const currency = { style: 'currency', currency: 'USD' } as const;

      [1234.5, -1234.5, 0.07].forEach((value) => {
        expect(parseNumber(new Intl.NumberFormat(locale).format(value), locale)).toBe(value);
        expect(
          parseNumber(new Intl.NumberFormat(locale, currency).format(value), locale, currency),
        ).toBe(value);
      });
      expect(
        parseNumber(new Intl.NumberFormat(locale, percent).format(0.125), locale, percent),
      ).toBe(0.125);
    });

    it('parses ASCII digits in a locale with non-Latin digits', () => {
      expect(parseNumber('1234.5', 'bn-BD-u-nu-beng')).toBe(1234.5);
      expect(parseNumber('-12', 'mr-IN-u-nu-deva')).toBe(-12);
    });

    it('parses digits from the numberingSystem option', () => {
      const format = { numberingSystem: 'deva' } as const;
      const formatted = new Intl.NumberFormat('en-US', format).format(1234.5);

      expect(parseNumber(formatted, 'en-US', format)).toBe(1234.5);
    });

    it.each([
      { name: 'en-US USD', locale: 'en-US', currency: 'USD' },
      { name: 'fr-FR EUR', locale: 'fr-FR', currency: 'EUR' },
      { name: 'ja-JP JPY', locale: 'ja-JP', currency: 'JPY' },
      { name: 'ar USD', locale: 'ar', currency: 'USD' },
      { name: 'de-DE EUR (minus sign)', locale: 'de-DE', currency: 'EUR' },
    ])('parses accounting negatives ($name)', ({ locale, currency }) => {
      const format = { style: 'currency', currency, currencySign: 'accounting' } as const;
      const formatter = new Intl.NumberFormat(locale, format);

      expect(parseNumber(formatter.format(-13), locale, format)).toBe(-13);
      expect(parseNumber(formatter.format(13), locale, format)).toBe(13);
    });

    it('parses typed accounting negatives', () => {
      const format = { style: 'currency', currency: 'USD', currencySign: 'accounting' } as const;
      expect(parseNumber('($14.00)', 'en-US', format)).toBe(-14);
      expect(parseNumber('(14)', 'en-US', format)).toBe(-14);
      // A sign typed after the closing parenthesis keeps the value negative
      expect(parseNumber('($14.00)-', 'en-US', format)).toBe(-14);
    });

    it('reads an accounting negative without its closing parenthesis as negative', () => {
      const format = { style: 'currency', currency: 'USD', currencySign: 'accounting' } as const;
      expect(parseNumber('($14.00', 'en-US', format)).toBe(-14);
      expect(parseNumber('(14', 'en-US', format)).toBe(-14);
      expect(parseNumber('(', 'en-US', format)).toBe(undefined);
    });

    it('does not read parentheses as a negative without the accounting format', () => {
      expect(parseNumber('($14.00)', 'en-US', { style: 'currency', currency: 'USD' })).toBe(
        undefined,
      );
    });

    // Irish uses `7 n-acra`, while the label for 1 is `acra`. Chromium's locale data uses `acres`.
    const acre = { style: 'unit', unit: 'acre', unitDisplay: 'long' } as const;
    const gaAcre = new Intl.NumberFormat('ga', acre).format(7);

    it.skipIf(!gaAcre.includes('-'))(
      'does not read a hyphen inside a unit label as a minus sign',
      () => {
        expect(parseNumber(gaAcre, 'ga', acre)).toBe(7);
      },
    );

    // Akan labels 1 as `grame 1` but other counts as `5 g`. Chromium's locale data uses `1 gram`.
    const gram = { style: 'unit', unit: 'gram', unitDisplay: 'long' } as const;
    const akGram = new Intl.NumberFormat('ak', gram);

    it.skipIf(!akGram.format(1).startsWith('grame'))(
      'strips a label that contains a shorter label of the same format',
      () => {
        expect([0, 1, -1, 5].map((value) => parseNumber(akGram.format(value), 'ak', gram))).toEqual(
          [0, 1, -1, 5],
        );
      },
    );

    // Sinhala puts the currency name before the number, and the AMD name contains a zero-width
    // joiner. Chromium's locale data uses English names.
    const siAmd = { style: 'currency', currency: 'AMD', currencyDisplay: 'name' } as const;
    const siFormatted = new Intl.NumberFormat('si', siAmd).format(12.5);

    it.skipIf(!/\p{Cf}/u.test(siFormatted))(
      'strips a label that contains a format control character',
      () => {
        expect(parseNumber(siFormatted, 'si', siAmd)).toBe(12.5);
      },
    );

    it('reads the group separator of locales that only group from six digits', () => {
      // ee formats `11111.1` without a separator but `1,234,567.89` with one
      const currency = { style: 'currency', currency: 'USD' } as const;

      expect(parseNumber(new Intl.NumberFormat('ee').format(1234567.89), 'ee')).toBe(1234567.89);
      expect(
        parseNumber(new Intl.NumberFormat('ee', currency).format(1234567.89), 'ee', currency),
      ).toBe(1234567.89);
    });

    it('reads the decimal separator of the numberingSystem option', () => {
      // ur uses `.` with Latin digits but `،` with Arabic ones
      const format = { numberingSystem: 'arab' } as const;
      const formatted = new Intl.NumberFormat('ur', format).format(1.5);

      expect(parseNumber(formatted, 'ur', format)).toBe(1.5);
      // The locale's usual separator still reads as the decimal
      expect(parseNumber('21,7', 'de-DE', format)).toBe(21.7);
    });

    it.each([
      { name: 'de-DE', locale: 'de-DE' },
      { name: 'de-CH', locale: 'de-CH' },
    ])('reads group separators of compact values below the abbreviation ($name)', ({ locale }) => {
      // `10.001` is grouped while `1,1 Mio.` is abbreviated
      const format = { notation: 'compact' } as const;
      const formatted = new Intl.NumberFormat(locale, format).format(10001);

      expect(parseNumber(formatted, locale, format)).toBe(10001);
    });

    it('reads a trailing minus after a complete label or Han numerals', () => {
      expect(parseNumber('12 kg-', 'en-US', { style: 'unit', unit: 'kilogram' })).toBe(-12);
      expect(
        parseNumber('12,00 USD-', 'de-DE', {
          style: 'currency',
          currency: 'USD',
          currencyDisplay: 'code',
        }),
      ).toBe(-12);
      expect(parseNumber('一二-', 'zh')).toBe(-12);
    });

    it('does not read the hyphen of an unfinished exponent as a minus sign', () => {
      expect(parseNumber('1.3E-', 'en-US', { notation: 'scientific' })).toBe(1.3);
    });

    it('does not read a hyphen left by a partly deleted label as a minus sign', () => {
      const format = { style: 'currency', currency: 'USD', currencyDisplay: 'name' } as const;

      // Backspacing `12,00 US-Dollar`
      expect(parseNumber('12,00 US-', 'de-DE', format)).toBe(12);
      expect(parseNumber('12,00-', 'de-DE', format)).toBe(-12);
    });

    it('keeps a dot typed before a separator or percent sign as the decimal', () => {
      expect(parseNumber('0.,25', 'en-US')).toBe(0.25);
      expect(parseNumber('$5.,00', 'en-US', { style: 'currency', currency: 'USD' })).toBe(5);
      expect(parseNumber("0.'25", 'de-CH')).toBe(0.25);
      expect(parseNumber('0.，25', 'en-US')).toBe(0.25);
      expect(parseNumber('0.٬25', 'en-US')).toBe(0.25);
      expect(parseNumber('0.%25', 'en-US', { style: 'percent' })).toBe(0.0025);
    });

    it('does not rescale a unit whose label contains a percent sign', () => {
      const format = { style: 'unit', unit: 'celsius-per-percent' } as const;
      const formatted = new Intl.NumberFormat('pl-PL', format).format(0.01);
      expect(formatted).toContain('%');

      expect(parseNumber(formatted, 'pl-PL', format)).toBe(0.01);
      // Long percent labels change with the plural form (`٢٪` but words for 1 in ar-EG)
      const percent = { style: 'unit', unit: 'percent', unitDisplay: 'long' } as const;
      expect(parseNumber(new Intl.NumberFormat('ar-EG', percent).format(2), 'ar-EG', percent)).toBe(
        2,
      );
      // A typed percent sign still scales other units
      expect(parseNumber('12%', 'en-US', { style: 'unit', unit: 'kilogram' })).toBe(0.12);
    });

    it('scales percent style even when a unit option is also set', () => {
      // Intl ignores `unit` outside unit style
      expect(parseNumber('13%', 'en-US', { style: 'percent', unit: 'percent' })).toBe(0.13);
    });

    it('BUG-5424: keeps only the last of many dots that are group separators', () => {
      expect(parseNumber(`0${'.000'.repeat(40000)}.5`, 'en-US')).toBe(0.5);
      expect(parseNumber(`${'.0'.repeat(40000)}.5`, 'en-US')).toBe(undefined);
    });

    it('parses units with different formats', () => {
      expect(parseNumber('12 km/h', 'en-US', { style: 'unit', unit: 'kilometer-per-hour' })).toBe(
        12,
      );
      expect(parseNumber('12 m/s', 'en-US', { style: 'unit', unit: 'meter-per-second' })).toBe(12);
    });

    it('treats bidi/format controls as ignorable in the middle of input', () => {
      expect(parseNumber('1\u202A234\u202C.56')).toBe(1234.56); // LRE...PDF
      expect(parseNumber('\u202A12\u202C%')).toBe(0.12);
    });

    it('gives undefined for Infinity with explicit sign and surrounding spaces', () => {
      expect(parseNumber(' +Infinity ')).toBe(undefined);
      expect(parseNumber(' -∞ ')).toBe(undefined);
      expect(parseNumber('+Infinity')).toBe(undefined);
    });

    it('collapses multiple consecutive dots keeping only the last as decimal', () => {
      expect(parseNumber('1..5')).toBe(1.5);
      expect(parseNumber('123..456..789.01')).toBe(123456789.01);
      expect(parseNumber('....5')).toBe(0.5);
    });

    // Guards the numeral-to-ASCII mapping: Arabic-Indic, Persian, and fullwidth digits are
    // decoded via `charCode % 16` (their ranges all start at a multiple of 16), and Han digits
    // via a digit-ordered lookup string. Existing cases only exercise a few digits, so these
    // pin the full 0-9 range of every system.
    it('maps the full Persian digit range', () => {
      expect(parseNumber('۹۸۷۶۵۴۳۲۱۰')).toBe(9876543210);
    });

    it('maps the full fullwidth digit range', () => {
      expect(parseNumber('０１２３４５６７８９')).toBe(123456789);
    });

    it('maps the full Arabic-Indic digit range', () => {
      expect(parseNumber('٩٨٧٦٥٤٣٢١٠')).toBe(9876543210);
    });

    it('maps the full Han digit range', () => {
      expect(parseNumber('九八七六五四三二一〇')).toBe(9876543210);
    });

    it('maps both Han zero forms to 0', () => {
      expect(parseNumber('零')).toBe(0);
      expect(parseNumber('〇')).toBe(0);
    });
  });

  // Every format must read back as the number it shows, also with a minus sign typed before or
  // after it. Expected numbers come from the engine's own `formatToParts`, not from the parser, so
  // the check follows each engine's locale data.
  describe('formatter round trip', () => {
    const FORMATS: Intl.NumberFormatOptions[] = [
      {},
      { maximumFractionDigits: 2 },
      { maximumFractionDigits: 0 },
      { maximumSignificantDigits: 3 },
      { useGrouping: false },
      { style: 'percent' },
      { style: 'percent', maximumFractionDigits: 1 },
      { notation: 'scientific' },
      { notation: 'engineering' },
      { notation: 'compact' },
      { signDisplay: 'exceptZero' },
      { numberingSystem: 'arab' },
      { numberingSystem: 'deva' },
      { style: 'currency', currency: 'USD' },
      { style: 'currency', currency: 'EUR' },
      { style: 'currency', currency: 'JPY' },
      { style: 'currency', currency: 'BRL' },
      { style: 'currency', currency: 'CHF', currencyDisplay: 'code' },
      { style: 'currency', currency: 'USD', currencyDisplay: 'name' },
      { style: 'currency', currency: 'USD', currencySign: 'accounting' },
      { style: 'currency', currency: 'EUR', currencySign: 'accounting' },
      { style: 'unit', unit: 'kilogram' },
      { style: 'unit', unit: 'celsius' },
      { style: 'unit', unit: 'kilometer-per-hour', unitDisplay: 'long' },
      { style: 'unit', unit: 'foot', unitDisplay: 'long' },
      { style: 'unit', unit: 'day', unitDisplay: 'long' },
      { style: 'unit', unit: 'liter', unitDisplay: 'narrow' },
    ];
    // Grouping and compact thresholds, plural forms, and negatives
    const VALUES = [
      0, 1, 2, 5, 1.5, 21.7, 1234.5, 10001, 123456.7, 1234567.891, 0.05, -1, -21.7, -1234.5,
      -123456.7,
    ];

    // The number the text shows, or `undefined` for text that can't be read back by design: a
    // compact suffix (`1.2K`) or a number written as words
    function getDisplayedNumber(formatter: Intl.NumberFormat, value: number) {
      const parts = formatter.formatToParts(value);
      if (
        parts.some((part) => part.type === 'compact') ||
        !parts.some((part) => part.type === 'integer')
      ) {
        return undefined;
      }

      const { numberingSystem, style } = formatter.resolvedOptions();
      const digitFormatter = new Intl.NumberFormat('en', { numberingSystem, useGrouping: false });
      const digits = new Map(
        Array.from({ length: 10 }, (_, digit) => [digitFormatter.format(digit), String(digit)]),
      );

      let isNegative = false;
      let text = '';
      parts.forEach((part) => {
        if (
          part.type === 'integer' ||
          part.type === 'fraction' ||
          part.type === 'exponentInteger'
        ) {
          text += Array.from(part.value, (char) => digits.get(char) ?? char).join('');
        } else if (part.type === 'decimal') {
          text += '.';
        } else if (part.type === 'exponentSeparator') {
          text += 'e';
        } else if (part.type === 'exponentMinusSign') {
          text += '-';
        } else if (
          part.type === 'minusSign' ||
          (part.type === 'literal' && part.value.includes('('))
        ) {
          isNegative = true;
        }
      });

      const number = Number(text) * (isNegative ? -1 : 1);
      return style === 'percent' ? Number(`${number}e-2`) : number;
    }

    it.each(
      [
        'en-US',
        'en-IN',
        'de-DE',
        'de-CH',
        'fr-FR',
        'fr-CH',
        'es-ES',
        'pt-BR',
        'it-IT',
        'nl-NL',
        'pl-PL',
        'ru-RU',
        'uk-UA',
        'cs-CZ',
        'sv-SE',
        'nb-NO',
        'fi-FI',
        'tr-TR',
        'el-GR',
        'he-IL',
        'ar-EG',
        'ar-SA',
        'fa-IR',
        'ur-PK',
        'hi-IN',
        'bn-BD-u-nu-beng',
        'mr-IN-u-nu-deva',
        'th-TH-u-nu-thai',
        'my-MM-u-nu-mymr',
        'zh-CN',
        'zh-CN-u-nu-hanidec',
        'ja-JP',
        'ko-KR',
        'vi-VN',
        'id-ID',
        'sw-KE',
        'eu-ES',
        'ee',
        'fy',
        'ga',
      ].map((locale) => ({ name: locale, locale })),
    )('reads back formatted values with and without a typed minus sign ($name)', ({ locale }) => {
      const failures: string[] = [];

      FORMATS.forEach((format) => {
        const formatter = new Intl.NumberFormat(locale, format);

        VALUES.forEach((value) => {
          const expected = getDisplayedNumber(formatter, value);
          if (expected === undefined) {
            return;
          }

          const text = formatter.format(value);
          const inputs: [string, number][] = [[text, expected]];
          // A typed minus sign negates a positive value, unless the text already shows a sign
          const hasSign = formatter.formatToParts(value).some((part) => part.type === 'plusSign');
          if (value > 0 && !hasSign) {
            inputs.push([`-${text}`, -expected], [`${text}-`, -expected]);
          }

          inputs.forEach(([input, number]) => {
            const parsed = parseNumber(input, locale, format);
            if (parsed !== number) {
              failures.push(
                `${JSON.stringify(format)} ${JSON.stringify(input)}: ${parsed} (expected ${number})`,
              );
            }
          });
        });
      });

      expect(failures).toEqual([]);
    });
  });
});

describe('the text of a number', () => {
  it('is the format of the value in the locale, and empty for null', () => {
    const text = createNumberText('de-DE', { style: 'currency', currency: 'EUR' });
    expect(text.format(1234.5)).toBe('1.234,50\u00a0€');
    expect(text.format(null)).toBe('');
  });
});

describe('the characters that the input accepts', () => {
  it.each(['0', '9', '٠', '٩', '۰', '۹', '０', '９', '零', '〇', '九'])(
    'accepts the digit %s of each numbering system',
    (digit) => {
      expect(createNumberText('en-US').accepts(digit, false)).toBe(true);
    },
  );

  it('accepts the separators, a plus sign and the control characters of a locale', () => {
    const enUS = createNumberText('en-US');
    expect(enUS.accepts('1,234.5．，٫٬+＋\u200e', false)).toBe(true);
    expect(createNumberText('fr-FR').accepts('1 234,5', false)).toBe(true);
    expect(createNumberText('bn-BD-u-nu-beng').accepts('১২', false)).toBe(true);
  });

  it('accepts a letter, a currency and a unit only where the format writes them', () => {
    expect(createNumberText('en-US').accepts('a', true)).toBe(false);
    expect(createNumberText('en-US').accepts('$5', true)).toBe(false);
    expect(
      createNumberText('en-US', { style: 'currency', currency: 'USD' }).accepts('$5', true),
    ).toBe(true);
    expect(
      createNumberText('en-US', { style: 'unit', unit: 'kilogram' }).accepts('5 kg', true),
    ).toBe(true);
    expect(createNumberText('en-US', { notation: 'scientific' }).accepts('5E3', true)).toBe(true);
    expect(createNumberText('en-US').accepts('5E3', true)).toBe(false);
  });

  it('accepts a percent sign and a per-mille sign only for a percent format', () => {
    expect(createNumberText('en-US').accepts('5%', true)).toBe(false);
    expect(createNumberText('en-US', { style: 'percent' }).accepts('5%٪％﹪‰؉', true)).toBe(true);
  });

  it('does not accept the suffix of a compact format', () => {
    expect(createNumberText('en-US', { notation: 'compact' }).accepts('1.2K', true)).toBe(false);
  });

  it('accepts minus signs and the parentheses of an accounting format only with negative', () => {
    const accounting = createNumberText('en-US', {
      style: 'currency',
      currency: 'USD',
      currencySign: 'accounting',
    });
    expect(accounting.accepts('($5)', true)).toBe(true);
    expect(accounting.accepts('($5)', false)).toBe(false);
    for (const minus of ['-', '−', '－', '‒', '–', '—', '﹣']) {
      expect(createNumberText('en-US').accepts(`${minus}5`, true)).toBe(true);
      expect(createNumberText('en-US').accepts(`${minus}5`, false)).toBe(false);
    }
  });

  it('accepts the minus sign of an exponent for each range', () => {
    expect(createNumberText('en-US', { notation: 'scientific' }).accepts('5E-3', false)).toBe(true);
  });
});

describe('a second separator, sign, percent sign or label', () => {
  it.each([
    ['en-US', {}, '1.5', false],
    ['en-US', {}, '1.5.', true],
    ['en-US', {}, '1,234.5', false],
    ['de-DE', {}, '1.234,5', false],
    ['de-DE', {}, '1,5,', true],
    ['en-US', {}, '-5', false],
    ['en-US', {}, '-5-', true],
    ['en-US', {}, '+-5', true],
    ['en-US', { notation: 'scientific' }, '-5E-3', false],
    ['en-US', { style: 'percent' }, '5%%', true],
    ['en-US', { style: 'currency', currency: 'USD' }, '$5$', true],
    ['en-US', { style: 'currency', currency: 'USD' }, '$5', false],
  ] as [string, Intl.NumberFormatOptions, string, boolean][])(
    '%s %j: %j has duplicates: %j',
    (locale, format, text, expected) => {
      expect(createNumberText(locale, format).hasDuplicates(text)).toBe(expected);
    },
  );
});

describe('the rounding of the format', () => {
  const round = (value: number, format: Intl.NumberFormatOptions) =>
    createNumberText('en-US', format).round(value);

  it('keeps each digit with no rounding option', () => {
    expect(round(1.234567890123456, {})).toBe(1.234567890123456);
    expect(round(1000, { style: 'currency', currency: 'USD' })).toBe(1000);
  });

  it('returns 0.3 for 0.2 + 0.1 with maximumFractionDigits', () => {
    expect(round(0.2 + 0.1, { maximumFractionDigits: 1 })).toBe(0.3);
  });

  it('rounds compact notation against its standard equivalent', () => {
    expect(round(1234.567, { notation: 'compact', maximumFractionDigits: 1 })).toBe(1234.6);
  });

  it.each([
    ['roundingMode floor', 1.239, { maximumFractionDigits: 2, roundingMode: 'floor' }, 1.23],
    ['half-even at a tie up', 1.235, { maximumFractionDigits: 2, roundingMode: 'halfEven' }, 1.24],
    [
      'half-even at a tie down',
      1.245,
      { maximumFractionDigits: 2, roundingMode: 'halfEven' },
      1.24,
    ],
    ['floor of a negative', -1.239, { maximumFractionDigits: 2, roundingMode: 'floor' }, -1.24],
    ['trunc of a negative', -1.239, { maximumFractionDigits: 2, roundingMode: 'trunc' }, -1.23],
    ['percent', 0.01236, { style: 'percent', maximumFractionDigits: 2 }, 0.0124],
    [
      'percent floor',
      0.01239,
      { style: 'percent', maximumFractionDigits: 2, roundingMode: 'floor' },
      0.0123,
    ],
    [
      'percent minimum digits',
      0.01239,
      { style: 'percent', minimumFractionDigits: 2, roundingMode: 'floor' },
      0.0123,
    ],
    ['significant digits', 12345, { maximumSignificantDigits: 3, roundingMode: 'floor' }, 12300],
    [
      'percent significant digits',
      0.01239,
      { style: 'percent', maximumSignificantDigits: 3, roundingMode: 'floor' },
      0.0123,
    ],
    [
      'percent significant noise',
      0.009995,
      { style: 'percent', maximumSignificantDigits: 2, roundingMode: 'floor' },
      0.0099,
    ],
    ['tiny percent', 0.000001234, { style: 'percent', maximumSignificantDigits: 2 }, 0.0000012],
    [
      'percent ceil',
      0.01230000001,
      { style: 'percent', maximumFractionDigits: 2, roundingMode: 'ceil' },
      0.0124,
    ],
    [
      'percent fraction digits',
      0.001234567890123456,
      { style: 'percent', maximumFractionDigits: 16 },
      0.001234567890123456,
    ],
    [
      'percent boundary',
      0.0046,
      { style: 'percent', maximumFractionDigits: 16, roundingMode: 'floor' },
      0.0046,
    ],
    ['21 fraction digits', 1e-21, { maximumFractionDigits: 21 }, 1e-21],
    [
      'priority of percent',
      0.0123456,
      { style: 'percent', maximumSignificantDigits: 3, roundingPriority: 'morePrecision' },
      0.0123,
    ],
    [
      'priority',
      1.2399,
      {
        minimumFractionDigits: 2,
        maximumSignificantDigits: 3,
        roundingMode: 'floor',
        roundingPriority: 'morePrecision',
      },
      1.239,
    ],
    [
      'unit percent',
      1.239,
      { style: 'unit', unit: 'percent', maximumFractionDigits: 2, roundingMode: 'floor' },
      1.23,
    ],
    [
      'currency',
      1.239,
      { style: 'currency', currency: 'USD', maximumFractionDigits: 2, roundingMode: 'floor' },
      1.23,
    ],
    [
      'scientific currency code',
      12345,
      {
        style: 'currency',
        currency: 'EUR',
        currencyDisplay: 'code',
        notation: 'scientific',
        maximumFractionDigits: 2,
      },
      12300,
    ],
    ['no sign display', -1.239, { maximumFractionDigits: 2, signDisplay: 'never' }, -1.24],
    [
      'accounting',
      -1.239,
      { style: 'currency', currency: 'USD', currencySign: 'accounting', maximumFractionDigits: 2 },
      -1.24,
    ],
    ['roundingMode alone', 1.2399, { minimumIntegerDigits: 1, roundingMode: 'floor' }, 1.239],
    [
      'roundingIncrement',
      1.26,
      { minimumFractionDigits: 1, maximumFractionDigits: 1, roundingIncrement: 5 },
      1.5,
    ],
    [
      'percent overflow',
      Number.MAX_VALUE,
      { style: 'percent', maximumFractionDigits: 2, roundingMode: 'floor' },
      Number.MAX_VALUE,
    ],
    ['scientific', 0.000123456, { notation: 'scientific', maximumFractionDigits: 2 }, 0.000123],
    [
      'scientific zero bucket kept',
      12345,
      {
        notation: 'scientific',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        roundingIncrement: 5,
      },
      12345,
    ],
    [
      'scientific zero bucket',
      1,
      {
        notation: 'scientific',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        roundingIncrement: 5,
      },
      0,
    ],
    ['minimum fraction digits', 1.234567, { minimumFractionDigits: 5 }, 1.23457],
  ] as [string, number, Intl.NumberFormatOptions, number][])(
    'rounds as the format shows: %s',
    (_name, value, format, expected) => {
      expect(round(value, format)).toBe(expected);
    },
  );

  it.each(['floor', 'ceil', 'trunc', 'expand'] as const)(
    'preserves exact percent precision boundaries with roundingMode: %s',
    (roundingMode) => {
      expect(round(0.0046, { style: 'percent', maximumFractionDigits: 2, roundingMode })).toBe(
        0.0046,
      );
    },
  );

  it('returns non-finite values untouched', () => {
    const format = { maximumFractionDigits: 2 };
    expect(round(Infinity, format)).toBe(Infinity);
    expect(round(-Infinity, format)).toBe(-Infinity);
    expect(round(NaN, format)).toBeNaN();
  });
});
