import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import * as Combobox from '../index.parts';

// Vue writes a comment around each fragment and slot.
function normalize(html: string) {
  return html.replace(/<!--.*?-->/g, '');
}

describe('<Combobox.Chips /> on a server', () => {
  it('renders the toolbar role, the chips and their remove buttons', async () => {
    const html = await renderToString(
      <Combobox.Root multiple defaultValue={['apple', 'banana']}>
        <Combobox.Chips>
          <Combobox.Chip>
            apple
            <Combobox.ChipRemove />
          </Combobox.Chip>
          <Combobox.Chip>banana</Combobox.Chip>
        </Combobox.Chips>
      </Combobox.Root>,
    );

    expect(normalize(html)).toContain(
      '<div role="toolbar"><div tabindex="-1">apple<button type="button" tabindex="-1" aria-disabled="false"></button></div><div tabindex="-1">banana</div></div>',
    );
  });
});
