import { describe, expect, it } from 'vitest';
import { shallowRef } from 'vue';
import { createRenderer, flushMicrotasks, screen } from '#test-utils';
import * as FilterDropdown from '../../../test/filterDropdown';
import { NOOP } from '../../common/empty';

describe('useFilterDropdownList', () => {
  const { render } = createRenderer();

  it('releases its id when a list with an id of its own unmounts', async () => {
    const listRef = shallowRef<HTMLElement[]>([]);
    const list = shallowRef<'generated' | 'own' | 'none'>('generated');
    await render(() => (
      <FilterDropdown.Root
        open
        value=""
        listRef={listRef}
        getActiveIndex={() => null}
        setActiveIndex={NOOP}
      >
        <FilterDropdown.Input aria-label="Filter" />
        {list.value === 'generated' ? <FilterDropdown.List key="generated" /> : null}
        {list.value === 'own' ? <FilterDropdown.List key="own" id="own-list" /> : null}
      </FilterDropdown.Root>
    ));
    const input = screen.getByRole('searchbox', { name: 'Filter' });
    const generatedId = screen.getByRole('menu').id;
    expect(input).toHaveAttribute('aria-controls', generatedId);

    list.value = 'own';
    await flushMicrotasks();
    expect(input).toHaveAttribute('aria-controls', 'own-list');

    list.value = 'none';
    await flushMicrotasks();

    expect(input).toHaveAttribute('aria-controls', generatedId);
  });
});
