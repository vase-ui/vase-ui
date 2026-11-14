import { describe, expect, it } from 'vitest';
import { shallowRef } from 'vue';
import { renderToString } from 'vue/server-renderer';
import * as FilterDropdown from '../../../test/filterDropdown';
import Item from '../../../test/fixtures/FilterDropdownItemPart.vue';
import { NOOP } from '../../common/empty';

function attribute(tag: string, name: string) {
  return new RegExp(` ${name}="([^"]*)"`).exec(tag)?.[1];
}

describe('<FilterDropdown.Root /> on a server', () => {
  it('renders each item, no empty message and the input that controls the list', async () => {
    const html = await renderToString(
      <FilterDropdown.Root
        open
        value="zz"
        listRef={shallowRef([])}
        getActiveIndex={() => null}
        setActiveIndex={NOOP}
      >
        <FilterDropdown.Popup>
          <FilterDropdown.Input aria-label="Filter countries" />
          <FilterDropdown.Empty>No matches</FilterDropdown.Empty>
          <FilterDropdown.List>
            <Item>Canada</Item>
            <Item>Mexico</Item>
          </FilterDropdown.List>
        </FilterDropdown.Popup>
      </FilterDropdown.Root>,
    );

    // Nothing filters on a server: no item registers there.
    expect(html).toContain('>Canada<');
    expect(html).toContain('>Mexico<');
    expect(html).not.toContain('No matches');

    const input = /<input[^>]*>/.exec(html)?.[0] ?? '';
    const list = /<div[^>]* role="menu"[^>]*>/.exec(html)?.[0] ?? '';
    expect(attribute(input, 'id')).toMatch(/^vase-ui-./);
    expect(attribute(input, 'role')).toBe('searchbox');
    expect(attribute(input, 'value')).toBe('zz');
    expect(attribute(list, 'id')).toMatch(/^vase-ui-./);
    expect(attribute(input, 'aria-controls')).toBe(attribute(list, 'id'));
  });
});
