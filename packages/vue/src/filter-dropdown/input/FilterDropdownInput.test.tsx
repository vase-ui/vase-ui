import { describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';
import { createRenderer, screen } from '#test-utils';
import * as FilterDropdown from '../../../test/filterDropdown';
import { NOOP } from '../../common/empty';
import type { FilterDropdownRootChangeEventDetails } from '../root/FilterDropdownRootContext';

describe('useFilterDropdownInput', () => {
  const { render } = createRenderer();

  it('shows the value of the root after a change that a listener cancels', async () => {
    const onValueChange = vi.fn((_value: string, details: FilterDropdownRootChangeEventDetails) =>
      details.cancel(),
    );
    const { user } = await render(
      <FilterDropdown.Root
        open
        value="ca"
        listRef={shallowRef([])}
        getActiveIndex={() => null}
        setActiveIndex={NOOP}
        onValueChange={onValueChange}
      >
        <FilterDropdown.Input aria-label="Filter" />
      </FilterDropdown.Root>,
    );
    const input = screen.getByRole('searchbox', { name: 'Filter' });

    await user.type(input, 'n');

    expect(onValueChange).toHaveBeenCalledWith('can', expect.anything());
    expect(input).toHaveValue('ca');
  });
});
