import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import * as Combobox from '../index.parts';

interface Person {
  id: string;
  name: string;
}

const sharedPersonItems = Combobox.createItems([] as Person[], {
  getValue: (person: Person) => person.id,
  getLabel: (person: Person) => person.name,
});

// The opening tag of the element that has `attribute`.
function getTag(html: string, attribute: string) {
  return new RegExp(`<[^>]*${attribute}[^>]*>`).exec(html)?.[0];
}

describe('Combobox.createItems on a server', () => {
  it('resolves a server-rendered defaultValue label from the external window', async () => {
    const html = await renderToString(
      <Combobox.Root
        items={sharedPersonItems}
        filteredItems={[{ id: 'user-1', name: 'Alice' }]}
        defaultValue="user-1"
      >
        <Combobox.Input data-testid="input" />
      </Combobox.Root>,
    );

    expect(getTag(html, 'data-testid="input"')).toContain('value="Alice"');
  });
});
