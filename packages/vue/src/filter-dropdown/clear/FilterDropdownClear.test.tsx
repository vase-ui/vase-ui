import { describe, expect, it, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import { createRenderer, describeConformance, screen } from '#test-utils';
import * as FilterDropdown from '../../../test/filterDropdown';
import { NOOP } from '../../common/empty';
import type { FilterDropdownRootChangeEventDetails } from '../root/FilterDropdownRootContext';

describe('<FilterDropdown.Clear />', () => {
  const { render } = createRenderer();

  describeConformance(<FilterDropdown.Clear />, () => ({
    refInstanceof: window.HTMLButtonElement,
    button: true,
    render(node) {
      return render(
        <ControlledFilterDropdownRoot initialValue="can">
          <FilterDropdown.Popup id={undefined}>
            <FilterDropdown.Input aria-label="Filter" />
            {node}
          </FilterDropdown.Popup>
        </ControlledFilterDropdownRoot>,
      );
    },
  }));

  it('does not render when the filter value is empty', async () => {
    await render(
      <ControlledFilterDropdownRoot>
        <FilterDropdown.Popup id={undefined}>
          <FilterDropdown.Input aria-label="Filter" />
          <FilterDropdown.Clear data-testid="clear" />
        </FilterDropdown.Popup>
      </ControlledFilterDropdownRoot>,
    );

    expect(screen.queryByTestId('clear')).toBe(null);
  });

  it('clears the filter value and focuses the input when clicked', async () => {
    const onValueChange = vi.fn();
    const { user } = await render(
      <ControlledFilterDropdownRoot initialValue="can" onValueChange={onValueChange}>
        <FilterDropdown.Popup id={undefined}>
          <FilterDropdown.Input aria-label="Filter countries" />
          <FilterDropdown.Clear aria-label="Clear filter" />
        </FilterDropdown.Popup>
      </ControlledFilterDropdownRoot>,
    );

    const input = screen.getByRole('searchbox', { name: 'Filter countries' });
    await user.click(screen.getByLabelText('Clear filter'));

    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    expect(screen.queryByLabelText('Clear filter')).toBe(null);
    expect(onValueChange).toHaveBeenLastCalledWith(
      '',
      expect.objectContaining({ reason: 'clear-press' }),
    );
  });

  it('does nothing when disabled', async () => {
    const { user } = await render(
      <ControlledFilterDropdownRoot initialValue="can">
        <FilterDropdown.Popup id={undefined}>
          <FilterDropdown.Input aria-label="Filter countries" />
          <FilterDropdown.Clear aria-label="Clear filter" disabled />
        </FilterDropdown.Popup>
      </ControlledFilterDropdownRoot>,
    );

    const clear = screen.getByLabelText('Clear filter');
    expect(clear).toBeDisabled();

    await user.click(clear);

    expect(screen.getByRole('searchbox', { name: 'Filter countries' })).toHaveValue('can');
  });

  it('ignores a click on a disabled non-native button', async () => {
    const onValueChange = vi.fn();

    const { user } = await render(
      <ControlledFilterDropdownRoot initialValue="can" onValueChange={onValueChange}>
        <FilterDropdown.Popup id={undefined}>
          <FilterDropdown.Input aria-label="Filter countries" />
          <FilterDropdown.Clear aria-label="Clear filter" disabled nativeButton={false} as="div" />
        </FilterDropdown.Popup>
      </ControlledFilterDropdownRoot>,
    );

    await user.click(screen.getByLabelText('Clear filter'));

    expect(onValueChange).not.toHaveBeenCalled();
  });
});

const ControlledFilterDropdownRoot = defineComponent(
  (
    props: {
      initialValue?: string | undefined;
      onValueChange?:
        ((value: string, eventDetails: FilterDropdownRootChangeEventDetails) => void) | undefined;
    },
    { slots },
  ) => {
    const value = shallowRef(props.initialValue ?? '');
    const listRef = shallowRef<HTMLElement[]>([]);

    return () => (
      <FilterDropdown.Root
        open
        value={value.value}
        listRef={listRef}
        getActiveIndex={getNoActiveIndex}
        setActiveIndex={NOOP}
        onValueChange={(nextValue, eventDetails) => {
          props.onValueChange?.(nextValue, eventDetails);
          value.value = nextValue;
        }}
        v-slots={slots}
      />
    );
  },
  { props: ['initialValue', 'onValueChange'] },
);

function getNoActiveIndex() {
  return null;
}
