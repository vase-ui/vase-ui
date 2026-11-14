import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import ComboboxInputPart from '../../../test/fixtures/ComboboxInputPart.vue';
import ComboboxListPart from '../../../test/fixtures/ComboboxListPart.vue';
import * as Autocomplete from '../../autocomplete/index.parts';
import * as Combobox from '../index.parts';

// Vue writes a comment around each fragment and slot. The style of a hidden input is long.
function normalize(html: string) {
  return html.replace(/<!--.*?-->/g, '').replace(/ style="[^"]+"/g, ' style');
}

// The opening tag of the element that has `attribute`.
function getTag(html: string, attribute: string) {
  return new RegExp(`<[^>]*${attribute}[^>]*>`).exec(html)?.[0];
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
      <Autocomplete.Root id="city" name="city" defaultValue="mal">
        <ComboboxInputPart />
      </Autocomplete.Root>,
    );

    expect(normalize(html)).toBe(
      `${comboboxInput('false', 'value="mal" name="city"')}<input id="city-hidden-input" value="mal" style tabindex="-1" aria-hidden="true">`,
    );
  });

  it('the server HTML has the name in mode none and one named input in each mode', async () => {
    const getNamedInputs = (html: string) =>
      [...html.matchAll(/<input [^>]*>/g)]
        .map(([tag]) => tag)
        .filter((tag) => tag.includes(' name="city"'));

    const noneHtml = await renderToString(
      <Autocomplete.Root id="city" name="city" defaultValue="mal">
        <Combobox.Input />
      </Autocomplete.Root>,
    );
    const singleHtml = await renderToString(
      <Combobox.Root id="city" name="city" items={['Malmö']} defaultValue="Malmö">
        <Combobox.Input />
      </Combobox.Root>,
    );

    expect(getNamedInputs(noneHtml)).toEqual([expect.stringContaining('role="combobox"')]);
    expect(getNamedInputs(noneHtml)[0]).toContain('value="mal"');
    expect(getNamedInputs(singleHtml)).toEqual([expect.stringContaining('aria-hidden="true"')]);
    expect(getNamedInputs(singleHtml)[0]).toContain('value="Malmö"');
  });

  it('sets combobox aria attributes on the input', async () => {
    const html = await renderToString(
      <Combobox.Root>
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner />
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const input = getTag(html, 'data-testid="input"');

    expect(input).toContain('role="combobox"');
    expect(input).toContain('aria-expanded="false"');
    expect(input).toContain('aria-autocomplete="list"');
    expect(input).toContain('aria-haspopup="listbox"');
  });

  it('sets combobox aria attributes on the trigger when input is inside popup', async () => {
    const html = await renderToString(
      <Combobox.Root>
        <Combobox.Trigger data-testid="trigger" />
        <Combobox.Portal>
          <Combobox.Positioner />
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const trigger = getTag(html, 'data-testid="trigger"');

    expect(trigger).toContain('role="combobox"');
    expect(trigger).toContain('aria-expanded="false"');
    expect(trigger).toContain('aria-haspopup="dialog"');
  });

  it('VUE-51: names the trigger with a label that comes before it', async () => {
    const html = await renderToString(
      <Combobox.Root id="food" inline>
        <Combobox.Label data-testid="label">Food</Combobox.Label>
        <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
        <Combobox.Input data-testid="input" />
      </Combobox.Root>,
    );

    expect(getTag(html, 'data-testid="label"')).toContain(' id="food-label"');
    expect(getTag(html, 'data-testid="trigger"')).toContain(' aria-labelledby="food-label"');
  });
});
