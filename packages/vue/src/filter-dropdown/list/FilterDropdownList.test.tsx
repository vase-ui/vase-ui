import { describe, expect, it } from 'vitest';
import { defineComponent, KeepAlive, shallowRef } from 'vue';
import { createRenderer, flushMicrotasks, screen } from '#test-utils';
import * as FilterDropdown from '../../../test/filterDropdown';
import { NOOP } from '../../common/empty';
import type { HTMLProps } from '../../internals/types';

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

    expect(input).not.toHaveAttribute('aria-controls');

    list.value = 'generated';
    await flushMicrotasks();

    expect(input).toHaveAttribute('aria-controls', generatedId);
  });

  describe('VUE-117: the input names the id that the list element has', () => {
    it('follows the id that the #render slot gives the list', async () => {
      const id = shallowRef('slot-list');
      await render(() => (
        <FilterDropdown.Root
          open
          value=""
          listRef={shallowRef([])}
          getActiveIndex={() => null}
          setActiveIndex={NOOP}
        >
          <FilterDropdown.Input aria-label="Filter" />
          <FilterDropdown.List
            v-slots={{
              // The slot writes the id after the props of the part, so the element has this id.
              render: ({ props }: { props: HTMLProps }) => <div {...props} id={id.value} />,
            }}
          />
        </FilterDropdown.Root>
      ));
      const input = screen.getByRole('searchbox', { name: 'Filter' });
      await flushMicrotasks();
      expect(input).toHaveAttribute('aria-controls', 'slot-list');

      id.value = 'second-list';
      await flushMicrotasks();
      expect(screen.getByRole('menu').id).toBe('second-list');
      expect(input).toHaveAttribute('aria-controls', 'second-list');

      id.value = '';
      await flushMicrotasks();
      expect(screen.getByRole('menu').id).toBe('');
      expect(input).not.toHaveAttribute('aria-controls');
    });

    it('names a newer list when an older list unmounts after it', async () => {
      const lists = shallowRef<'old' | 'both' | 'new'>('old');
      await render(() => (
        <FilterDropdown.Root
          open
          value=""
          listRef={shallowRef([])}
          getActiveIndex={() => null}
          setActiveIndex={NOOP}
        >
          <FilterDropdown.Input aria-label="Filter" />
          {lists.value !== 'new' ? <FilterDropdown.List key="old" id="old-list" /> : null}
          {lists.value !== 'old' ? <FilterDropdown.List key="new" id="new-list" /> : null}
        </FilterDropdown.Root>
      ));
      const input = screen.getByRole('searchbox', { name: 'Filter' });
      await flushMicrotasks();
      expect(input).toHaveAttribute('aria-controls', 'old-list');

      lists.value = 'both';
      await flushMicrotasks();
      expect(input).toHaveAttribute('aria-controls', 'new-list');

      lists.value = 'new';
      await flushMicrotasks();
      expect(input).toHaveAttribute('aria-controls', 'new-list');
    });

    it('has no aria-controls while KeepAlive holds the list', async () => {
      const shown = shallowRef(true);
      const List = defineComponent(() => () => <FilterDropdown.List />);
      await render(() => (
        <FilterDropdown.Root
          open
          value=""
          listRef={shallowRef([])}
          getActiveIndex={() => null}
          setActiveIndex={NOOP}
        >
          <FilterDropdown.Input aria-label="Filter" />
          <KeepAlive>{shown.value ? <List /> : null}</KeepAlive>
        </FilterDropdown.Root>
      ));
      const input = screen.getByRole('searchbox', { name: 'Filter' });
      await flushMicrotasks();
      const listId = screen.getByRole('menu').id;
      expect(input).toHaveAttribute('aria-controls', listId);

      shown.value = false;
      await flushMicrotasks();
      expect(screen.queryByRole('menu')).toBe(null);
      expect(input).not.toHaveAttribute('aria-controls');

      shown.value = true;
      await flushMicrotasks();
      expect(input).toHaveAttribute('aria-controls', listId);
    });
  });
});
