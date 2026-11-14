import { describe, expect, it } from 'vitest';
import { defineComponent, KeepAlive, shallowRef } from 'vue';
import { createRenderer, fireEvent, flushMicrotasks, screen } from '#test-utils';
import CompositeItem from '../../../../test/fixtures/CompositeItemPart.vue';
import CompositeRoot from '../../../../test/fixtures/CompositeRootPart.vue';
import CompositeItemTabStop from '../item/CompositeItemTabStop.test.vue';

const ITEMS = ['a', 'b', 'c'];

function readTabindexes() {
  return ITEMS.map((testId) => screen.queryByTestId(testId)?.getAttribute('tabindex') ?? null);
}

// A family writes the attributes of an item itself, so the test does the same.
function renderItem(testId: string, active: string | null, disabled: string[] = []) {
  return (
    <CompositeItem
      key={testId}
      data-testid={testId}
      active={testId === active}
      data-composite-item-active={testId === active ? '' : undefined}
      disabled={disabled.includes(testId)}
      aria-disabled={disabled.includes(testId) ? 'true' : undefined}
    />
  );
}

function createList(initial: { active: string | null; disabled?: string[]; items?: string[] }) {
  const active = shallowRef(initial.active);
  const disabled = shallowRef(initial.disabled ?? []);
  const items = shallowRef(initial.items ?? ITEMS);
  const List = defineComponent(() => () => (
    <CompositeRoot data-testid="root">
      {items.value.map((testId) => renderItem(testId, active.value, disabled.value))}
      <button type="button" data-testid="inner" />
    </CompositeRoot>
  ));

  return { List, active, disabled, items };
}

async function focusItem(testId: string) {
  screen.getByTestId(testId).focus();
  await flushMicrotasks();
}

async function blurItem(testId: string) {
  screen.getByTestId(testId).blur();
  await flushMicrotasks();
}

describe('VUE-51: the tab stop follows the active item', () => {
  const { render } = createRenderer();

  it('moves the tab stop to an item that becomes active while the focus is outside', async () => {
    const { List, active } = createList({ active: 'a' });
    await render(<List />);
    expect(readTabindexes()).toEqual(['0', '-1', '-1']);

    active.value = 'b';
    await flushMicrotasks();

    expect(readTabindexes()).toEqual(['-1', '0', '-1']);
  });

  it('keeps the tab stop on the focused item, and the keys continue from that item', async () => {
    const { List, active } = createList({ active: 'a' });
    await render(<List />);
    await focusItem('c');

    active.value = 'b';
    await flushMicrotasks();

    expect(readTabindexes()).toEqual(['-1', '-1', '0']);

    await fireEvent.keyDown(screen.getByTestId('c'), { key: 'ArrowLeft' });
    await flushMicrotasks();

    expect(screen.getByTestId('b')).toHaveFocus();
  });

  it('moves the tab stop to the active item when the focus leaves', async () => {
    const { List, active } = createList({ active: 'a' });
    await render(<List />);
    await focusItem('c');
    active.value = 'b';
    await flushMicrotasks();

    await blurItem('c');

    expect(readTabindexes()).toEqual(['-1', '0', '-1']);
  });

  it('keeps the tab stop while the focus moves to another element of the root', async () => {
    const { List } = createList({ active: 'a' });
    await render(<List />);
    await focusItem('c');

    await focusItem('inner');

    expect(readTabindexes()).toEqual(['-1', '-1', '0']);
  });

  it('moves the tab stop to the first enabled item when no item is active', async () => {
    const { List, active } = createList({ active: 'c', disabled: ['a'] });
    await render(<List />);
    expect(readTabindexes()).toEqual(['-1', '-1', '0']);

    active.value = null;
    await flushMicrotasks();

    expect(readTabindexes()).toEqual(['-1', '0', '-1']);
  });

  it('gives the tab stop to an active item only while the item is enabled', async () => {
    const { List, active, disabled } = createList({ active: 'b', disabled: ['c'] });
    await render(<List />);

    active.value = 'c';
    await flushMicrotasks();

    expect(readTabindexes()).toEqual(['0', '-1', '-1']);

    disabled.value = [];
    await flushMicrotasks();

    expect(readTabindexes()).toEqual(['-1', '-1', '0']);
  });

  it('does not give the tab stop to an active item that is hidden', async () => {
    const active = shallowRef('b');
    const List = defineComponent(() => () => (
      <CompositeRoot>
        {renderItem('a', active.value)}
        {renderItem('b', active.value)}
        <CompositeItem
          data-testid="c"
          style={{ display: 'none' }}
          active={active.value === 'c'}
          data-composite-item-active={active.value === 'c' ? '' : undefined}
        />
      </CompositeRoot>
    ));
    await render(<List />);

    active.value = 'c';
    await flushMicrotasks();

    expect(readTabindexes()).toEqual(['0', '-1', '-1']);
  });

  it.each([
    { name: 'the focus leaves', nextItems: ITEMS, nextDisabled: [] },
    { name: 'an item mounts', nextItems: [...ITEMS, 'd'], nextDisabled: [] },
    { name: 'another item becomes disabled', nextItems: ITEMS, nextDisabled: ['b'] },
  ])(
    'keeps the tab stop of the user with no active item when $name',
    async ({ nextItems, nextDisabled }) => {
      const { List, disabled, items } = createList({ active: null });
      await render(<List />);
      await focusItem('c');
      await blurItem('c');

      items.value = nextItems;
      disabled.value = nextDisabled;
      await flushMicrotasks();

      expect(readTabindexes()).toEqual(['-1', '-1', '0']);
    },
  );

  it('moves the tab stop to an active item that mounts in a mounted list', async () => {
    const { List, items } = createList({ active: 'b', items: ['a', 'c'] });
    await render(<List />);
    expect(readTabindexes()).toEqual(['0', null, '-1']);

    items.value = ITEMS;
    await flushMicrotasks();

    expect(readTabindexes()).toEqual(['-1', '0', '-1']);
  });

  it('moves the tab stop in a root that gets its element again on each patch', async () => {
    // The fixture binds `rootRef` in its template, so Vue calls it after each patch of the root.
    const { setProps } = await render(<CompositeItemTabStop hasActiveItem active={['a']} />);
    expect(readTabindexes()).toEqual(['0', '-1', '-1']);

    await setProps({ active: ['c'] });
    await flushMicrotasks();

    expect(readTabindexes()).toEqual(['-1', '-1', '0']);
  });

  describe('KeepAlive', () => {
    const NEW_ITEM = { name: 'moves the tab stop to a new active item', value: 'a' };
    const NO_ITEM = { name: 'moves the tab stop when no item is active', value: null };

    it.each([
      { ...NEW_ITEM, part: 'the items' },
      { ...NO_ITEM, part: 'the items' },
      { ...NEW_ITEM, part: 'the root' },
      { ...NO_ITEM, part: 'the root' },
    ])('$name, with $part in KeepAlive', async ({ value, part }) => {
      const active = shallowRef<string | null>('b');
      const visible = shallowRef(true);
      const Items = defineComponent(
        () => () => ITEMS.map((testId) => renderItem(testId, active.value)),
      );
      const Root = defineComponent(() => () => (
        <CompositeRoot>
          <Items />
        </CompositeRoot>
      ));
      const Other = defineComponent(() => () => <span data-testid="other" />);
      const List = defineComponent(
        () => () =>
          part === 'the root' ? (
            <KeepAlive>{visible.value ? <Root /> : <Other />}</KeepAlive>
          ) : (
            <CompositeRoot>
              <KeepAlive>{visible.value ? <Items /> : <Other />}</KeepAlive>
            </CompositeRoot>
          ),
      );
      await render(<List />);
      expect(readTabindexes()).toEqual(['-1', '0', '-1']);

      visible.value = false;
      await flushMicrotasks();
      expect(screen.getByTestId('other')).toBeInTheDocument();

      active.value = value;
      await flushMicrotasks();

      visible.value = true;
      await flushMicrotasks();

      expect(readTabindexes()).toEqual(['0', '-1', '-1']);
    });
  });
});
