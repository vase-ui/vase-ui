import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { getFilter } from '../../internals/filter';
import AutocompleteRootHydration from './AutocompleteRootHydration.test.vue';

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

function getOptions(html: string) {
  return [...html.matchAll(/role="option"[^>]*>([^<]*)</g)].map(([, text]) => text.trim());
}

function getNamedInputs(html: string) {
  return [...html.matchAll(/<input [^>]*>/g)]
    .map(([tag]) => tag)
    .filter((tag) => tag.includes(' name="search"'));
}

describe('<Autocomplete.Root /> on a server', () => {
  // `getFilter` keeps the filter for no locale, with the runtime locale of its first use. This case
  // is thus the first case of the file.
  it('VUE-44: filters the server HTML with en-US, not with the runtime locale', async () => {
    mockRuntimeCollatorLocale('sv');
    expect(getFilter({ locale: 'en-US' }).contains('Malmö', 'malmo')).toBe(true);
    expect(getFilter().contains('Malmö', 'malmo')).toBe(false);

    const html = await renderToString(<AutocompleteRootHydration inline defaultValue="malmo" />);

    expect(getOptions(html)).toEqual(['Malmö']);
  });

  it('gives the name to the visible input only', async () => {
    const html = await renderToString(
      <AutocompleteRootHydration name="search" defaultValue="Oslo" />,
    );

    expect(getNamedInputs(html)).toEqual([expect.stringContaining('role="combobox"')]);
    expect(getNamedInputs(html)[0]).toContain('value="Oslo"');
    expect(html).toContain('<span data-testid="value">Oslo</span>');
  });

  it('gives no named input while the root has no input outside the popup', async () => {
    const html = await renderToString(
      <AutocompleteRootHydration name="search" defaultValue="Oslo" noInput />,
    );

    expect(getNamedInputs(html)).toEqual([]);
    expect(html).toMatch(/<input id="city-hidden-input" value="Oslo"/);
  });

  it('sets aria-autocomplete from mode, and none for readOnly', async () => {
    const listHtml = await renderToString(<AutocompleteRootHydration />);
    const bothHtml = await renderToString(<AutocompleteRootHydration mode="both" />);
    const readOnlyHtml = await renderToString(<AutocompleteRootHydration mode="both" readOnly />);

    expect(listHtml).toContain('aria-autocomplete="list"');
    expect(bothHtml).toContain('aria-autocomplete="both"');
    expect(readOnlyHtml).toContain('aria-autocomplete="none"');
  });
});
