import { expect, describe, it, vi } from 'vitest';
import { getFilter } from './filter';

describe('getFilter', () => {
  it('caches different locales separately', () => {
    const filter1 = getFilter({ locale: new Intl.Locale('fr-FR') });
    const filter2 = getFilter({ locale: new Intl.Locale('en-US') });

    expect(filter1).not.toBe(filter2);
  });

  it('caches equivalent locale inputs', () => {
    const filter1 = getFilter({ locale: new Intl.Locale('fr-FR') });
    const filter2 = getFilter({ locale: 'fr-FR' });

    expect(filter1).toBe(filter2);
  });

  it('compares each different window of text with a query one time', () => {
    const compare = Object.getOwnPropertyDescriptor(Intl.Collator.prototype, 'compare')!.get!;
    let comparisons = 0;
    const spy = vi.spyOn(Intl.Collator.prototype, 'compare', 'get').mockImplementation(function (
      this: Intl.Collator,
    ) {
      comparisons += 1;
      return compare.call(this);
    });
    try {
      const { contains } = getFilter({ locale: 'en-US' });
      const labels = Array.from({ length: 1000 }, (_, index) => `Option ${index + 1}`);
      expect(labels.filter((label) => contains(label, '9'))).toHaveLength(271);
      // The windows are the 6 letters of "Option", the space and the 10 digits.
      expect(comparisons).toBe(17);
    } finally {
      spy.mockRestore();
    }
  });

  it('matches locale-aware substrings without accent sensitivity', () => {
    const contains = getFilter({ locale: 'en-US' }).contains;

    expect(contains('Résumé', 'resume')).toBe(true);
  });
});
