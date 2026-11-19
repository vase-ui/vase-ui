// Measurements with native elements and plain Vue, with no code of the library, for Progress and
// Meter. Each one states what the browser or Vue does, so that a part has code only where they do
// not do it. `range-screen-readers.html` is the measurement for NVDA and JAWS, which a person does
// on Windows.
import { describe, expect, test } from 'vitest';
import MeasureLabelOnServer from '../fixtures/MeasureLabelOnServer.vue';
import { hydrate, renderOnServer, settle } from '../render';

describe('the name of a range from a label in it', () => {
  test('the server HTML has no aria-labelledby from a child that gives its id in setup; the attribute comes after the hydration', async () => {
    const root = await renderOnServer('MeasureLabelOnServer');
    const range = root.querySelector('[role=progressbar]')!;
    const label = root.querySelector('span')!;
    expect(label.id).not.toBe('');
    expect(range).not.toHaveAttribute('aria-labelledby');
    hydrate(MeasureLabelOnServer, {}, root);
    await settle();
    expect(range).toHaveAttribute('aria-labelledby', label.id);
  });
});

const LOCALES = ['en-US', 'de-DE', 'fr-FR', 'ja-JP', 'ar-EG'];
const FORMATS: { options: Intl.NumberFormatOptions; value: number }[] = [
  { options: { style: 'percent' }, value: 0.425 },
  { options: { style: 'decimal', maximumFractionDigits: 2 }, value: 1234.567 },
  { options: { style: 'currency', currency: 'EUR' }, value: 1234.5 },
];
const ROWS = LOCALES.flatMap((locale) => FORMATS.map((format) => ({ locale, ...format })));

describe('the text of a number', () => {
  test('Intl.NumberFormat gives the same text in Node and in the browser', async () => {
    const root = await renderOnServer('MeasureNumberText', { rows: ROWS });
    const texts = (items: Iterable<Element>) => [...items].map((item) => item.textContent);
    const ofBrowser = ROWS.map(({ locale, options, value }) =>
      new Intl.NumberFormat(locale, options).format(value),
    );
    expect(texts(root.querySelectorAll('li'))).toEqual(ofBrowser);
  });
});
