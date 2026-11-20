/** The text of a number in a locale and a format, and the number of a text. */
export interface NumberText {
  /** The text of the value: empty for `null`. */
  format(value: number | null): string;
  /** The number of the text: `null` for an empty text, and `undefined` when it is not a number. */
  parse(text: string): number | null | undefined;
  /**
   * Each character of the text is one that the input accepts. Minus signs and the parentheses of
   * an accounting format count only with `negative`.
   */
  accepts(text: string, negative: boolean): boolean;
  /** The text has more than one decimal separator, sign, percent sign, currency or unit. */
  hasDuplicates(text: string): boolean;
  /** The number as the format rounds it, when the format has a rounding option. */
  round(value: number): number;
}

const minusSigns = '-−－‒–—﹣';
const plusSigns = '+＋﹢';
const percentSigns = '%٪％﹪';
const permilleSigns = '‰؉';
// Han numerals in digit order, after the two forms of zero.
const hanDigits = '零〇一二三四五六七八九';
const roundingOptions = [
  'minimumFractionDigits',
  'maximumFractionDigits',
  'minimumSignificantDigits',
  'maximumSignificantDigits',
  'roundingIncrement',
  'roundingMode',
  'roundingPriority',
] as const;
// Numbers with a group separator and a fraction, so that each part of the format shows. Some
// locales group only from 6 digits (`11111.1` in ee), and a compact format abbreviates 7 digits.
const samples = [1111111.1, 11111.1];
// Labels change with the plural form (`1 foot`, `2 feet`; `7 n-acra` in ga; `1,02 eura` in bs).
const pluralSamples = [0, 1, 2, 3, 5, 6, 7, 11, 21, 100, 0.02, 1.01, 1.5, 1.49, 1e6];

const controls = /\p{Cf}/gu;
const minusPattern = /[-−－‒–—﹣]/gu;
const plusPattern = /[+＋﹢]/gu;
// Arabic-Indic, Persian and full-width digits start at a multiple of 16.
const otherDigits = /[٠-٩۰-۹０-９]/;
// Text with two dots or more is a number only when each dot before the last one can be a group
// separator (https://github.com/mui/base-ui/issues/5424). A sign after a label is still there.
const dotsAsGroups = /^[-+]?\d{1,3}(?:\.\d{3})+\.[^.]*$/;

export function createNumberText(
  locale: Intl.LocalesArgument,
  options: Intl.NumberFormatOptions = {},
): NumberText {
  const formatter = new Intl.NumberFormat(locale, options);
  const parse = createParser(locale, options);
  const { numberingSystem, style } = formatter.resolvedOptions();
  const decimal = decimalSeparator(locale, numberingSystem);
  const plainParts = new Intl.NumberFormat(locale, { numberingSystem }).formatToParts(1111111.1);
  const group = plainParts.find((part) => part.type === 'group')?.value;

  const positive = new Set<string>();
  const exponentSigns = new Set<string>();
  const labels = new Set<string>();
  for (const value of [...samples, ...pluralSamples]) {
    for (const part of formatter.formatToParts(value)) {
      if (part.type === 'currency' || part.type === 'unit') labels.add(part.value);
      if (part.type === 'exponentMinusSign') for (const sign of part.value) exponentSigns.add(sign);
      // The suffix of a compact format, such as `K`, is not text that a user types.
      if (part.type !== 'compact') for (const character of part.value) positive.add(character);
    }
  }
  // A minus sign that the format writes in an exponent is text for each range.
  const negativeOnly = new Set(Array.from(minusSigns).filter((sign) => !exponentSigns.has(sign)));
  for (const part of formatter.formatToParts(-1111111.1)) {
    for (const character of part.value) {
      if (!positive.has(character)) negativeOnly.add(character);
    }
  }
  const percent = style === 'percent';
  const accepted = new Set([
    ...Array.from('0123456789٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹０１２３４５６７８９'),
    ...Array.from(hanDigits),
    ...Array.from('.,．，٫٬'),
    decimal,
    ...Array.from(group ?? ''),
    // A locale that groups with a space character also takes a typed space.
    ...(group && /\p{Zs}/u.test(group) ? [' '] : []),
    ...Array.from(plusSigns),
    ...positive,
    ...(percent ? Array.from(percentSigns + permilleSigns) : []),
  ]);

  const count = (text: string, test: (character: string) => boolean) =>
    Array.from(text).filter(test).length;
  const isDecimal = (character: string) =>
    character === decimal ||
    '．٫'.includes(character) ||
    // A dot or a comma that the locale does not group with is a decimal separator.
    ((character === '.' || character === ',') && character !== group);

  return {
    format: (value) => (value === null ? '' : formatter.format(value)),
    parse,
    accepts(text, negative) {
      return Array.from(text.replace(controls, '')).every(
        (character) =>
          (accepted.has(character) && !negativeOnly.has(character)) ||
          (negative && negativeOnly.has(character)),
      );
    },
    hasDuplicates(text) {
      const rest = text.replace(controls, '');
      // The sign of an exponent, such as `1E-3`, is not the sign of the number.
      const signs = rest.replace(/[eE][-+−]/g, '');
      return (
        count(rest, isDecimal) > 1 ||
        count(signs, (character) => (minusSigns + plusSigns).includes(character)) > 1 ||
        count(rest, (character) => (percentSigns + permilleSigns).includes(character)) > 1 ||
        [...labels].some((label) => rest.split(label).length > 2)
      );
    },
    round: createRounding(options),
  };
}

function decimalSeparator(locale: Intl.LocalesArgument, numberingSystem?: string) {
  return (
    new Intl.NumberFormat(locale, { numberingSystem, useGrouping: false })
      .formatToParts(0.1)
      .find((part) => part.type === 'decimal')?.value ?? '.'
  );
}

/** Reads the number of a text that a user typed or pasted, in the locale and the format. */
function createParser(locale: Intl.LocalesArgument, options: Intl.NumberFormatOptions) {
  const formatter = new Intl.NumberFormat(locale, options);
  const parts = samples.flatMap((value) => formatter.formatToParts(value));
  const partOf = (type: string) => parts.findLast((part) => part.type === type)?.value;
  const group = partOf('group');
  const exponentSeparator = partOf('exponentSeparator');
  const decimal = decimalSeparator(locale, options.numberingSystem);
  // A `numberingSystem` option changes the separator, and a user can still type the usual one.
  const usualDecimal = decimalSeparator(locale);
  const ownDigits = Array.from(
    new Intl.NumberFormat(locale, {
      numberingSystem: options.numberingSystem,
      useGrouping: false,
    }).format(9876543210),
  ).reverse();
  // The longest first, so that a short label (`g`) does not cut into a longer one (`grame` in ak).
  const labels = [
    ...new Set(
      [...samples, ...pluralSamples]
        .flatMap((value) => formatter.formatToParts(value))
        .filter((part) => part.type === 'currency' || part.type === 'unit')
        .map((part) => part.value.replace(controls, '')),
    ),
  ].sort((a, b) => b.length - a.length);
  let groupPattern: string | RegExp | undefined = group;
  if (group && /\p{Zs}/u.test(group)) groupPattern = /\p{Zs}/gu;
  // Some environments group with an ASCII apostrophe, and others with a curly one.
  else if (group && /['’]/.test(group)) groupPattern = /['’]/g;

  const toAsciiDigits = (text: string) =>
    text.replace(/[\p{Nd}零〇一二三四五六七八九]/gu, (character) => {
      const own = ownDigits.indexOf(character);
      if (own !== -1) return String(own);
      const han = hanDigits.indexOf(character);
      if (han !== -1) return String(Math.max(han - 1, 0));
      return otherDigits.test(character) ? String(character.charCodeAt(0) % 16) : character;
    });

  return function parse(text: string): number | null | undefined {
    let input = text.replace(controls, '').trim();
    if (input === '') return null;
    input = input.replace(minusPattern, '-').replace(plusPattern, '+');
    let negative = false;
    const takeSign = (_match: string, sign: string) => {
      if (sign !== '+') negative = true;
      return '';
    };
    input = input.replace(/^\s*([+-])/, takeSign);
    // The labels go while they still match, so that a dot in a label (`st. C`) is no separator.
    for (const label of labels) input = input.replaceAll(label, '');
    input = toAsciiDigits(input);
    // The separator of an exponent can hold digits (`×۱۰^` in fa-IR).
    if (exponentSeparator) input = input.replaceAll(toAsciiDigits(exponentSeparator), 'e');
    // A hyphen after a letter is the rest of a label (`US-` of `US-Dollar`) or of an exponent.
    input = input.replace(/(?<![\p{L}\p{M}])([+-])\s*$/u, takeSign);
    // An accounting format writes a negative number in parentheses. The first one is enough.
    if (options.currencySign === 'accounting') input = input.replace(/^\s*(\()/, takeSign);
    if (groupPattern) input = input.replaceAll(groupPattern, '');
    // With no groups, a decimal separator comes before a digit. A dot that does not is the rest
    // of a label (`21,5 st.`). The symbols that go below do not count (`0.，25`, `0.%25`).
    input = input.replace(/\.(?![，٬%٪％﹪‰؉]*\d)/g, '');
    let number = input
      .replaceAll(decimal, '.')
      .replaceAll(usualDecimal, '.')
      .replace(/[．٫]/g, '.')
      .replace(/[，٬%٪％﹪‰؉]/g, '')
      // The space that a label before the number leaves (`R$ 13,00`).
      .trim()
      .replace(/\.{2,}/g, '.');
    if (number.indexOf('.') !== number.lastIndexOf('.') && !dotsAsGroups.test(number)) {
      return undefined;
    }
    number = number.replace(/\.(?=[^.]*\.)/g, '');
    if (/^[-+]?Infinity$/i.test(input) || input.includes('∞')) return undefined;
    let result = Number.parseFloat(`${negative ? '-' : ''}${number}`);
    // A percent sign counts after the labels go, so that a label with one (`celsius-per-percent`)
    // does not scale the number.
    if (/[‰؉]/.test(input)) result = shiftDecimal(result, -3);
    else if (
      !(options.style === 'unit' && options.unit === 'percent') &&
      (/[%٪％﹪]/.test(input) || options.style === 'percent')
    ) {
      result = shiftDecimal(result, -2);
    }
    return Number.isFinite(result) ? result : undefined;
  };
}

function shiftDecimal(value: number, places: number) {
  const [coefficient, exponent = '0'] = String(value).split('e');
  return Number(`${coefficient}e${Number(exponent) + places}`);
}

/**
 * Rounds a number as the format shows it. The text of the format in `en-US`, with no grouping and
 * no sign decoration, gives the rounded number. A compact format rounds as a standard one.
 */
function createRounding(options: Intl.NumberFormatOptions) {
  if (!roundingOptions.some((option) => options[option] !== undefined)) {
    return (value: number) => value;
  }
  const formatter = new Intl.NumberFormat('en-US', {
    ...options,
    signDisplay: 'auto',
    currencySign: 'standard',
    notation: options.notation === 'compact' ? 'standard' : options.notation,
    useGrouping: false,
  });
  const parse = createParser('en-US', options);
  return (value: number) => {
    if (!Number.isFinite(value)) return value;
    const text = formatter.format(value);
    const rounded = parse(text);
    // A rounding that the text cannot give back, such as an overflow, keeps the number.
    return typeof rounded === 'number' && formatter.format(rounded) === text ? rounded : value;
  };
}
