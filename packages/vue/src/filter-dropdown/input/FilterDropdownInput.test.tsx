import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { nextTick, shallowRef } from 'vue';
import { createRenderer, fireEvent, screen, waitFor } from '#test-utils';
import * as FilterDropdown from '../../../test/filterDropdown';
import { NOOP } from '../../common/empty';
import type { FilterDropdownRootChangeEventDetails } from '../root/FilterDropdownRootContext';

describe('useFilterDropdownInput', () => {
  const { render } = createRenderer();

  it('ignores focus events from the input it replaced', async () => {
    const key = shallowRef(0);
    const listRef = shallowRef<HTMLElement[]>([]);
    await render(() => (
      <FilterDropdown.Root
        open
        value=""
        listRef={listRef}
        getActiveIndex={() => null}
        setActiveIndex={NOOP}
      >
        <FilterDropdown.Input key={key.value} />
      </FilterDropdown.Root>
    ));
    const old = screen.getByRole('searchbox');
    key.value++;
    await nextTick();
    const input = screen.getByRole('searchbox');
    input.focus();
    await nextTick();
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('data-highlighted');

    document.body.append(old);
    onTestFinished(() => old.remove());
    old.focus();
    await nextTick();
    expect(old).toHaveFocus();
    expect(input).not.toHaveAttribute('data-highlighted');

    old.addEventListener('focusout', () => input.focus(), { capture: true, once: true });
    old.blur();
    await nextTick();
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('data-highlighted');
  });

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
