import { describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';
import { createRenderer, fireEvent, screen } from '#test-utils';
import * as FilterDropdown from '../../../test/filterDropdown';
import { NOOP } from '../../common/empty';
import type { FilterDropdownRootChangeEventDetails } from '../root/FilterDropdownRootContext';

describe('useFilterDropdownInput', () => {
  const { render } = createRenderer();

  it('shows the value of the root after a change that a listener cancels', async () => {
    const onValueChange = vi.fn((_value: string, details: FilterDropdownRootChangeEventDetails) =>
      details.cancel(),
    );
    await render(
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

    // A key press would also change the keyboard state, and that render writes the value too.
    await fireEvent.input(input, { target: { value: 'can' } });

    expect(onValueChange).toHaveBeenCalledWith('can', expect.anything());
    expect(input).toHaveValue('ca');
  });
});
