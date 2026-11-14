import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { Autocomplete } from '@vase-ui/vue/autocomplete';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import { Input } from '@vase-ui/vue/input';
import { getFilter } from '../../internals/filter';
import AutocompleteRootHydration from './AutocompleteRootHydration.test.vue';

type ItemSlotProps = { item: string };

const itemSlot = {
  item: ({ item }: ItemSlotProps) => <Autocomplete.Item value={item}>{item}</Autocomplete.Item>,
};

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

// Vue writes a comment around each fragment and slot.
function removeComments(html: string) {
  return html.replace(/<!--.*?-->/g, '');
}

function getOptions(html: string) {
  return [...removeComments(html).matchAll(/role="option"[^>]*>([^<]*)</g)].map(([, text]) =>
    text.trim(),
  );
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
    expect(removeComments(html)).toContain('<span data-testid="value">Oslo</span>');
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

  describe('Form', () => {
    it('server-renders only the inline input name for native FormData', async () => {
      const html = await renderToString(
        <Form>
          <Field.Root name="search">
            <Autocomplete.Root items={['alpha', 'alpine']} inline>
              <Autocomplete.Input data-testid="input" />
              <Autocomplete.List v-slots={itemSlot} />
            </Autocomplete.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      expect(getNamedInputs(html)).toEqual([expect.stringContaining('data-testid="input"')]);
    });

    it('server-renders only the outside-popup input name for native FormData', async () => {
      const html = await renderToString(
        <Form>
          <Field.Root name="search">
            <Autocomplete.Root items={['alpha', 'alpine']}>
              <Autocomplete.InputGroup>
                <Autocomplete.Input data-testid="input" />
                <Autocomplete.Trigger>Open</Autocomplete.Trigger>
              </Autocomplete.InputGroup>
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List v-slots={itemSlot} />
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      expect(getNamedInputs(html)).toEqual([expect.stringContaining('data-testid="input"')]);
    });

    it('server-renders the default popup input value without a form name before hydration', async () => {
      const html = await renderToString(
        <Form>
          <Field.Root name="search">
            <Autocomplete.Root items={['alpha', 'alpine']} defaultValue="alpha">
              <Autocomplete.Trigger>
                <Autocomplete.Value />
              </Autocomplete.Trigger>
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.Input as={Input} data-testid="input" />
                    <Autocomplete.List v-slots={itemSlot} />
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      expect(html).toMatch(/<input [^>]*value="alpha"/);
      expect(getNamedInputs(html)).toEqual([]);
      expect(html).not.toContain('data-testid="input"');
    });
  });
});
