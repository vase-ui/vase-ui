import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import AutocompleteRootPart from '../../../test/fixtures/AutocompleteRootPart.vue';
import ComboboxInputPart from '../../../test/fixtures/ComboboxInputPart.vue';
import ComboboxListPart from '../../../test/fixtures/ComboboxListPart.vue';
import * as Combobox from '../index.parts';

// Vue writes a comment around each fragment and slot. The style of a hidden input is long.
function normalize(html: string) {
  return html.replace(/<!--.*?-->/g, '').replace(/ style="[^"]+"/g, ' style');
}

function comboboxInput(expanded: 'true' | 'false', attributes: string) {
  return `<input autocomplete="off" spellcheck="false" autocorrect="off" autocapitalize="none" role="combobox" aria-expanded="${expanded}" aria-haspopup="listbox" aria-autocomplete="list" ${attributes}>`;
}

describe('<Combobox.Root /> on a server', () => {
  it('renders the role of the input and one named hidden input for a single value', async () => {
    const html = await renderToString(
      <Combobox.Root id="city" name="city" items={['Malmö', 'Oslo']} defaultValue="Oslo">
        <ComboboxInputPart />
        <ComboboxListPart />
      </Combobox.Root>,
    );

    expect(normalize(html)).toBe(
      `${comboboxInput('false', 'value="Oslo"')}<input name="city" value="Oslo" style tabindex="-1" aria-hidden="true">`,
    );
  });

  it('renders one named input for each value of a multiple root', async () => {
    const html = await renderToString(
      <Combobox.Root
        id="city"
        name="city"
        multiple
        items={['a', 'b', 'c']}
        defaultValue={['a', 'b']}
      >
        <ComboboxInputPart />
      </Combobox.Root>,
    );

    expect(normalize(html)).toBe(
      `${comboboxInput('false', 'value')}<input id="city-hidden-input" value style tabindex="-1" aria-hidden="true"><input type="hidden" name="city" value="a"><input type="hidden" name="city" value="b">`,
    );
  });

  it('renders a `type="hidden"` input for a root with no name', async () => {
    const html = await renderToString(
      <Combobox.Root id="city">
        <ComboboxInputPart />
      </Combobox.Root>,
    );

    expect(normalize(html)).toBe(
      `${comboboxInput('false', 'value')}<input id="city-hidden-input" type="hidden" value style tabindex="-1" aria-hidden="true">`,
    );
  });

  it('renders the filtered options of an open inline list', async () => {
    const html = await renderToString(
      <Combobox.Root
        id="city"
        inline
        open
        items={['Malmö', 'Malta', 'Oslo']}
        defaultInputValue="mal"
      >
        <ComboboxInputPart />
        <ComboboxListPart />
      </Combobox.Root>,
    );

    expect(normalize(html)).toBe(
      `${comboboxInput('true', 'value="mal"')}<div><div><div id="city-list" role="presentation"><div id="city-0" role="option">Malmö</div><div id="city-1" role="option">Malta</div></div></div></div><input id="city-hidden-input" type="hidden" value style tabindex="-1" aria-hidden="true">`,
    );
  });

  it('gives the name only to the input when the root selects nothing', async () => {
    const html = await renderToString(
      <AutocompleteRootPart id="city" name="city" defaultInputValue="mal">
        <ComboboxInputPart />
      </AutocompleteRootPart>,
    );

    expect(normalize(html)).toBe(
      `${comboboxInput('false', 'value="mal" name="city"')}<input id="city-hidden-input" value="mal" style tabindex="-1" aria-hidden="true">`,
    );
  });
});
