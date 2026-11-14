import { describe, expect, it } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import { createRenderer, flushMicrotasks, screen } from '#test-utils';
import * as FilterDropdown from '../../../test/filterDropdown';
import Group from '../../../test/fixtures/FilterDropdownGroupPart.vue';
import Item from '../../../test/fixtures/FilterDropdownItemPart.vue';
import { NOOP } from '../../common/empty';

describe('useFilterDropdownGroup', () => {
  const { render } = createRenderer();

  it('hides a group of groups only when the query hides each group in it', async () => {
    const App = defineComponent(
      (props: { value: string }) => {
        const listRef = shallowRef<HTMLElement[]>([]);
        return () => (
          <FilterDropdown.Root
            open
            value={props.value}
            listRef={listRef}
            getActiveIndex={() => null}
            setActiveIndex={NOOP}
          >
            <FilterDropdown.List>
              <Group data-testid="americas">
                <Group data-testid="north">
                  <Item>Canada</Item>
                </Group>
                <Group data-testid="central">
                  <Item>Panama</Item>
                </Group>
              </Group>
              <Item>Spain</Item>
            </FilterDropdown.List>
          </FilterDropdown.Root>
        );
      },
      { props: ['value'] },
    );

    const { setProps } = await render(<App value="can" />);
    await flushMicrotasks();

    expect(screen.getByTestId('central')).toHaveAttribute('hidden');
    expect(screen.getByTestId('north')).not.toHaveAttribute('hidden');
    expect(screen.getByTestId('americas')).not.toHaveAttribute('hidden');

    await setProps({ value: 'spa' });
    await flushMicrotasks();

    expect(screen.getByTestId('north')).toHaveAttribute('hidden');
    expect(screen.getByTestId('americas')).toHaveAttribute('hidden');
  });
});
