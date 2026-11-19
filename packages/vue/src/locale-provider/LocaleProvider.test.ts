import { describe, expect, test } from 'vitest';
import { nextTick, reactive } from 'vue';
import RangesInLocaleProviders from '../../test/fixtures/RangesInLocaleProviders.vue';
import { mockRuntimeLocale } from '../../test/mockRuntimeLocale';
import { hydrate, mount, renderOnServer, settle } from '../../test/render';

const text = (locale: string) =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(1234.567);

/** The element of the text of each range of the fixture, by the name of the range. */
function values(root: Element) {
  return Object.fromEntries(
    [...root.querySelectorAll('[aria-label]')].map((range) => [
      range.getAttribute('aria-label')!,
      range.querySelector('[aria-hidden]')!,
    ]),
  );
}

const texts = (root: Element) =>
  Object.fromEntries(
    Object.entries(values(root)).map(([name, value]) => [name, value.textContent]),
  );

describe('the locale of a part', () => {
  test.each([
    { name: 'Meter', locale: 'de-DE', rule: 'a part with no locale prop has the provider locale' },
    { name: 'Progress', locale: 'de-DE', rule: 'Progress has the provider locale' },
    { name: 'Meter with a locale', locale: 'ar-EG', rule: 'the locale prop of a part wins' },
    { name: 'Meter in the inner provider', locale: 'fr-FR', rule: 'the nearest provider wins' },
    {
      name: 'Meter with no provider',
      locale: 'en-US',
      rule: 'with no provider, the part has en-US',
    },
  ])('$rule', async ({ name, locale }) => {
    mockRuntimeLocale('de-CH');
    const { root } = mount(RangesInLocaleProviders, {
      locales: { outer: 'de-DE', inner: 'fr-FR', meter: 'ar-EG' },
    });
    await nextTick();
    expect(texts(root)[name]).toBe(text(locale));
  });

  test('a change of the locale of a provider formats the text again, in the same elements', async () => {
    const locales = reactive({ outer: 'de-DE', inner: 'fr-FR' });
    const { root } = mount(RangesInLocaleProviders, { locales });
    await nextTick();
    const before = values(root);
    locales.outer = 'ar-EG';
    await nextTick();
    expect(values(root)).toEqual(before);
    expect(texts(root)).toEqual({
      Meter: text('ar-EG'),
      Progress: text('ar-EG'),
      'Meter with a locale': text('ar-EG'),
      'Meter in the inner provider': text('fr-FR'),
      'Meter with no provider': text('en-US'),
    });
  });
});

test('VUE-169: the server HTML has the locale of each part, and the text stays after the hydration in a browser with another locale', async () => {
  const props = { locales: { outer: 'de-DE', inner: 'fr-FR', meter: 'ar-EG' } };
  const root = await renderOnServer('RangesInLocaleProviders', props);
  const server = texts(root);
  expect(server).toEqual({
    Meter: text('de-DE'),
    Progress: text('de-DE'),
    'Meter with a locale': text('ar-EG'),
    'Meter in the inner provider': text('fr-FR'),
    'Meter with no provider': text('en-US'),
  });
  mockRuntimeLocale('de-CH');
  hydrate(RangesInLocaleProviders, props, root);
  await settle();
  expect(texts(root)).toEqual(server);
});
