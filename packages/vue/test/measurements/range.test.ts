// Measurements with plain Vue and native elements, with no code of the library. Each one states
// what the browser or Vue does, so that a part has code only where they do not do it.
import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import MeasureLabelOnServer from '../fixtures/MeasureLabelOnServer.vue';
import MeasureNumberText from '../fixtures/MeasureNumberText.vue';
import { hydrate, mount, renderOnServer } from '../render';

describe('an attribute of a parent that a child gives in its setup', () => {
  test('is not in the server HTML, and comes after the hydration', async () => {
    const root = await renderOnServer('MeasureLabelOnServer');
    const meter = root.querySelector('[role=meter]')!;
    expect(meter).not.toHaveAttribute('aria-labelledby');
    hydrate(MeasureLabelOnServer, {}, root);
    await nextTick();
    expect(meter).toHaveAttribute('aria-labelledby', 'label');
  });
});

describe('the text of Intl.NumberFormat', () => {
  test('is the same in Node and in the browser', async () => {
    const cases = ['en-US', 'de-DE', 'fr-FR', 'ja-JP', 'ar-EG'].flatMap((locale) =>
      [
        { style: 'percent' },
        { style: 'decimal', maximumFractionDigits: 2 },
        { style: 'currency', currency: 'EUR' },
      ].map((options) => ({ locale, options })),
    );
    const props = { cases, value: 1234.567 };
    const texts = (root: Element) => [...root.querySelectorAll('p')].map((p) => p.textContent);
    const server = texts(await renderOnServer('MeasureNumberText', props));
    expect(texts(mount(MeasureNumberText, props).root)).toEqual(server);
  });
});
