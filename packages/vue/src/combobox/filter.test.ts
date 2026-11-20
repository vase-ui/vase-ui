import { describe, expect, test } from 'vitest';
import { defineComponent, h, nextTick, reactive } from 'vue';
import { Autocomplete } from '@vase-ui/vue/autocomplete';
import { Combobox } from '@vase-ui/vue/combobox';
import { LocaleProvider } from '@vase-ui/vue/locale-provider';
import { mount } from '../../test/render';

type Filter = ReturnType<typeof Combobox.useFilter>;

/** Calls `use` in the `setup` of a component, in a `LocaleProvider` with `locale`. */
function inSetup(use: () => Filter, locale?: string) {
  let filter: Filter | undefined;
  const Probe = defineComponent(() => {
    filter = use();
    return () => null;
  });
  mount(
    defineComponent(() => () =>
      locale ? h(LocaleProvider, { locale }, () => h(Probe)) : h(Probe),
    ),
  );
  return filter!;
}

describe('useFilter', () => {
  test('contains, startsWith and endsWith compare with no regard to case, accents and punctuation', () => {
    const filter = inSetup(() => Combobox.useFilter());
    expect(filter.contains('Crème brûlée', 'creme')).toBe(true);
    expect(filter.contains('Apple', 'pl')).toBe(true);
    expect(filter.startsWith('Apple', 'ap')).toBe(true);
    expect(filter.startsWith('Apple', 'pl')).toBe(false);
    expect(filter.endsWith('Apple', 'LE')).toBe(true);
    expect(filter.contains('Apple', '')).toBe(true);
  });

  test('with the option `value`, contains keeps each item while the query is the label of that value; `multiple` turns it off', async () => {
    const options = reactive({ value: 'Apple' as string | undefined, multiple: false });
    const filter = inSetup(() => Combobox.useFilter(() => options));
    expect(filter.contains('Banana', 'apple')).toBe(true);
    expect(filter.contains('Banana', 'app')).toBe(false);
    options.multiple = true;
    await nextTick();
    expect(filter.contains('Banana', 'apple')).toBe(false);
  });

  test('the locale is `en-US` with no option, else the nearest LocaleProvider, else the option', () => {
    // In Swedish, "ä" is a letter of its own, and in English it is "a" with an accent.
    expect(inSetup(() => Combobox.useFilter()).contains('Ärla', 'arla')).toBe(true);
    expect(inSetup(() => Autocomplete.useFilter(), 'sv-SE').contains('Ärla', 'arla')).toBe(false);
    expect(
      inSetup(() => Autocomplete.useFilter({ locale: 'en-US' }), 'sv-SE').contains('Ärla', 'arla'),
    ).toBe(true);
  });
});
