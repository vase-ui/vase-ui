import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import * as Combobox from '../index.parts';

// The opening tag of the element that has `attribute`.
function getTag(html: string, attribute: string) {
  return html.match(new RegExp(`<[^>]*${attribute}[^>]*>`))?.[0];
}

describe('<Combobox.List /> on a server', () => {
  it('renders the items with the ids of their indices and their selected state', async () => {
    const html = await renderToString(
      <Combobox.Root id="fruit" inline defaultValue="banana">
        <Combobox.Input />
        <Combobox.List>
          <Combobox.Group>
            <Combobox.GroupLabel>Fruits</Combobox.GroupLabel>
            <Combobox.Item value="apple">Apple</Combobox.Item>
            <Combobox.Item value="banana">
              Banana
              <Combobox.ItemIndicator data-testid="indicator" />
            </Combobox.Item>
          </Combobox.Group>
          <Combobox.Separator />
        </Combobox.List>
      </Combobox.Root>,
    );

    expect(getTag(html, 'role="listbox"')).toBeDefined();
    expect(getTag(html, 'role="group"')).toBeDefined();
    expect(getTag(html, 'id="fruit-0"')).toContain('aria-selected="false"');
    expect(getTag(html, 'id="fruit-1"')).toContain('aria-selected="true"');
    expect(getTag(html, 'data-testid="indicator"')).toContain('data-selected');
    expect(getTag(html, 'role="presentation"')).toContain('data-orientation="horizontal"');
  });
});
