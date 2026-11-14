import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { getFilter } from '../../../internals/filter';
import UseFilterProbe from './UseFilterProbe.test.vue';

// Makes `Intl.Collator` use `locale` when a call gives no locale, until the test ends.
function mockRuntimeCollatorLocale(locale: string) {
  const Collator = Intl.Collator;
  const collatorSpy = vi
    .spyOn(Intl, 'Collator')
    .mockImplementation(function MockCollator(requestedLocale, options) {
      return new Collator(requestedLocale ?? locale, options);
    });
  onTestFinished(() => collatorSpy.mockRestore());
}

describe('VUE-44: filters with en-US until the component is mounted when it has no locale', () => {
  it('filters the server HTML with en-US, not with the runtime locale', async () => {
    mockRuntimeCollatorLocale('sv');
    expect(getFilter({ locale: 'en-US', numeric: true }).contains('Malmö', 'malmo')).toBe(true);
    expect(getFilter({ numeric: true }).contains('Malmö', 'malmo')).toBe(false);

    const html = await renderToString(<UseFilterProbe />);

    expect(html).toContain('<li>Malmö</li>');
  });

  it('filters the server HTML with the locale of the options, not with the runtime locale', async () => {
    mockRuntimeCollatorLocale('en-US');

    const html = await renderToString(<UseFilterProbe locale="sv" />);

    expect(html).not.toContain('Malmö');
  });
});
