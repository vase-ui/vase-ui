import { describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { createRenderer, screen } from '#test-utils';
import type { FilterDropdownRootChangeEventDetails } from './FilterDropdownRootContext';
import { useFilterDropdownCloseQuery } from './useFilterDropdownCloseQuery';

describe('useFilterDropdownCloseQuery', () => {
  const { render } = createRenderer();

  const Host = defineComponent(
    (props: {
      open: boolean;
      mounted: boolean;
      value: string;
      onValueChange: (value: string, details: FilterDropdownRootChangeEventDetails) => void;
    }) => {
      const query = useFilterDropdownCloseQuery({
        open: () => props.open,
        mounted: () => props.mounted,
        value: () => props.value,
        onValueChange: (value, details) => props.onValueChange(value, details),
      });
      return () => <span data-testid="query">{query.value}</span>;
    },
    { props: ['open', 'mounted', 'value', 'onValueChange'] },
  );

  it('keeps the query while the popup closes and clears it after the unmount', async () => {
    const onValueChange = vi.fn();
    const { setProps } = await render(
      <Host open mounted value="ca" onValueChange={onValueChange} />,
    );

    await setProps({ open: false });
    await setProps({ open: false, value: 'can' });

    expect(screen.getByTestId('query').textContent).toBe('ca');
    expect(onValueChange).not.toHaveBeenCalled();

    await setProps({ open: false, value: 'can', mounted: false });

    expect(screen.getByTestId('query').textContent).toBe('can');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(
      '',
      expect.objectContaining({ reason: 'popup-close' }),
    );
  });

  it('settles the reset when the popup opens again before the unmount', async () => {
    const onValueChange = vi.fn();
    const { setProps } = await render(
      <Host open mounted value="ca" onValueChange={onValueChange} />,
    );

    await setProps({ open: false });
    await setProps({ open: true });

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(
      '',
      expect.objectContaining({ reason: 'popup-close' }),
    );
  });

  it('clears the query one time when the host unmounts while the popup closes', async () => {
    const onValueChange = vi.fn();
    const { setProps, unmount } = await render(
      <Host open mounted value="ca" onValueChange={onValueChange} />,
    );

    await setProps({ open: false });
    unmount();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(
      '',
      expect.objectContaining({ reason: 'popup-close' }),
    );
  });
});
