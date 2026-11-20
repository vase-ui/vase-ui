import { describe, expect, test } from 'vitest';
import { nextTick, reactive } from 'vue';
import type { Combobox } from '@vase-ui/vue/combobox';
import ComboboxFilterProbe from '../../test/fixtures/ComboboxFilterProbe.vue';
import { mount } from '../../test/render';

type Filter = ReturnType<typeof Combobox.useFilter>;

/** The filter of `useFilter` of the family, in a `LocaleProvider` with `locale`. */
function inSetup(
  family: 'combobox' | 'autocomplete',
  options?: Record<string, unknown>,
  locale?: string,
) {
  const { exposed } = mount(ComboboxFilterProbe, { family, options, locale });
  return exposed.filter as Filter;
}

describe('useFilter', () => {
  test('contains, startsWith and endsWith compare with no regard to case, accents and punctuation', () => {
    const filter = inSetup('combobox');
    expect(filter.contains('Crème brûlée', 'creme')).toBe(true);
    expect(filter.contains('Apple', 'pl')).toBe(true);
    expect(filter.startsWith('Apple', 'ap')).toBe(true);
    expect(filter.startsWith('Apple', 'pl')).toBe(false);
    expect(filter.endsWith('Apple', 'LE')).toBe(true);
    expect(filter.contains('Apple', '')).toBe(true);
  });

  test('with the option `value`, contains keeps each item while the query is the label of that value; `multiple` turns it off', async () => {
    const options = reactive({ value: 'Apple' as string | undefined, multiple: false });
    const filter = inSetup('combobox', options);
    expect(filter.contains('Banana', 'apple')).toBe(true);
    expect(filter.contains('Banana', 'app')).toBe(false);
    options.multiple = true;
    await nextTick();
    expect(filter.contains('Banana', 'apple')).toBe(false);
  });

  test('VUE-44: the locale is the option, else the nearest LocaleProvider, else `en-US`', () => {
    // In Swedish, "ä" is a letter of its own, and in English it is "a" with an accent.
    expect(inSetup('combobox').contains('Ärla', 'arla')).toBe(true);
    expect(inSetup('autocomplete', {}, 'sv-SE').contains('Ärla', 'arla')).toBe(false);
    expect(inSetup('autocomplete', { locale: 'en-US' }, 'sv-SE').contains('Ärla', 'arla')).toBe(
      true,
    );
  });
});
