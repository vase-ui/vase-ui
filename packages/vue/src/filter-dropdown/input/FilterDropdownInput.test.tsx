import { describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';
import { createRenderer, fireEvent, screen, waitFor } from '#test-utils';
import * as FilterDropdown from '../../../test/filterDropdown';
import { NOOP } from '../../common/empty';
import type { FilterDropdownRootChangeEventDetails } from '../root/FilterDropdownRootContext';

describe('useFilterDropdownInput', () => {
  const { render } = createRenderer();

  it('keeps a new composition when the previous composition timer runs', async () => {
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
    vi.useFakeTimers();
    try {
      await fireEvent.compositionStart(input);
      await fireEvent.input(input, { target: { value: 'a' }, inputType: 'insertCompositionText' });
      await fireEvent.compositionEnd(input);
      expect(onValueChange).toHaveBeenCalledTimes(1);

      await fireEvent.compositionStart(input);
      await fireEvent.input(input, { target: { value: 'ab' }, inputType: 'insertCompositionText' });
      await vi.advanceTimersByTimeAsync(0);

      expect(input).toHaveValue('ab');
      expect(onValueChange).toHaveBeenCalledTimes(1);

      await fireEvent.compositionEnd(input);
      await vi.advanceTimersByTimeAsync(0);

      expect(input).toHaveValue('ab');
      expect(onValueChange).toHaveBeenCalledTimes(2);
      expect(onValueChange).toHaveBeenLastCalledWith('ab', expect.anything());
    } finally {
      vi.useRealTimers();
    }
  });

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

  it('reports a refused composition once when WebKit sends its final input', async () => {
    const onValueChange = vi.fn();
    await render(
      <FilterDropdown.Root
        open
        value="old"
        listRef={shallowRef([])}
        getActiveIndex={() => null}
        setActiveIndex={NOOP}
        onValueChange={onValueChange}
      >
        <FilterDropdown.Input aria-label="Filter" />
      </FilterDropdown.Root>,
    );
    const input = screen.getByRole<HTMLInputElement>('searchbox', { name: 'Filter' });
    await fireEvent.compositionStart(input);
    input.value = 'マ';
    const end = fireEvent.compositionEnd(input);
    await fireEvent.input(input, { target: { value: 'マ' }, inputType: 'insertCompositionText' });
    await end;

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('マ', expect.anything());
    await waitFor(() => expect(input).toHaveValue('old'));
  });

  it('reports edits only from input events', async () => {
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

    await fireEvent.change(input, { target: { value: 'canada' } });

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith(
      'can',
      expect.objectContaining({ reason: 'input-change' }),
    );
  });
});
