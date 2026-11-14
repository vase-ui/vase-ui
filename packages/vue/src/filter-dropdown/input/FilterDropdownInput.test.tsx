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

  it('reports a change event only when its value is new', async () => {
    const value = shallowRef('');
    const onValueChange = vi.fn((nextValue: string) => {
      value.value = nextValue;
    });
    await render(() => (
      <FilterDropdown.Root
        open
        value={value.value}
        listRef={shallowRef([])}
        getActiveIndex={() => null}
        setActiveIndex={NOOP}
        onValueChange={onValueChange}
      >
        <FilterDropdown.Input aria-label="Filter" />
      </FilterDropdown.Root>
    ));
    const input = screen.getByRole<HTMLInputElement>('searchbox', { name: 'Filter' });

    // A browser sends `change` after the `input` events, when the input loses the focus.
    await fireEvent.input(input, { target: { value: 'can' } });
    await fireEvent.change(input);

    expect(onValueChange).toHaveBeenCalledTimes(1);

    // A browser can fill an input and send only `change`.
    await fireEvent.change(input, { target: { value: 'canada' } });

    expect(onValueChange).toHaveBeenCalledTimes(2);
    expect(onValueChange).toHaveBeenLastCalledWith(
      'canada',
      expect.objectContaining({ reason: 'input-change' }),
    );
  });
});
