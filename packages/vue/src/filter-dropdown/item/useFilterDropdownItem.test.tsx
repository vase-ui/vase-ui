import { describe, expect, it } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import { createRenderer, flushMicrotasks, screen, waitFor } from '#test-utils';
import * as FilterDropdown from '../../../test/filterDropdown';
import Item from '../../../test/fixtures/FilterDropdownItemPart.vue';
import { NOOP } from '../../common/empty';
import { useFilterDropdownItem } from './useFilterDropdownItem';

describe('useFilterDropdownItem', () => {
  const { render } = createRenderer();

  const TestFilterDropdownRoot = defineComponent(
    (props: { value: string }, { slots }) => {
      const listRef = shallowRef<HTMLElement[]>([]);
      return () => (
        <FilterDropdown.Root
          open
          value={props.value}
          listRef={listRef}
          getActiveIndex={() => null}
          setActiveIndex={NOOP}
        >
          <FilterDropdown.List>{slots.default?.()}</FilterDropdown.List>
        </FilterDropdown.Root>
      );
    },
    { props: ['value'] },
  );

  it('renders a late item one time to read its text, then keeps it only when it matches', async () => {
    const App = defineComponent(
      (props: { late: boolean }) => () => (
        <TestFilterDropdownRoot value="pa">
          <Item>Spain</Item>
          {props.late ? <Item>Panama</Item> : null}
          {props.late ? <Item>Mexico</Item> : null}
        </TestFilterDropdownRoot>
      ),
      { props: ['late'] },
    );

    const { setProps } = await render(<App late={false} />);
    const addedTexts: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => addedTexts.push(node.textContent ?? ''));
      }
    });
    observer.observe(screen.getByRole('menu'), { childList: true, subtree: true });

    await setProps({ late: true });
    await flushMicrotasks();
    observer.disconnect();

    expect(addedTexts).toContain('Mexico');
    expect(screen.getByRole('menuitem', { name: 'Panama' })).toBeVisible();
    expect(screen.queryByRole('menuitem', { name: 'Mexico' })).toBe(null);
  });

  it('shows a hidden item again when the text of its slot changes to a match', async () => {
    const name = shallowRef('Mexico');
    await render(() => (
      <TestFilterDropdownRoot value="pa">
        <Item>Spain</Item>
        <Item>{name.value}</Item>
      </TestFilterDropdownRoot>
    ));
    await flushMicrotasks();
    expect(screen.queryByRole('menuitem', { name: 'Mexico' })).toBe(null);

    name.value = 'Panama';

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Panama' })).toBeVisible();
    });
  });

  it('hides a visible item when its text changes to no match', async () => {
    const name = shallowRef('Panama');
    await render(() => (
      <TestFilterDropdownRoot value="pan">
        <Item>Spain</Item>
        <Item>{name.value}</Item>
      </TestFilterDropdownRoot>
    ));
    await flushMicrotasks();
    expect(screen.getByRole('menuitem', { name: 'Panama' })).toBeVisible();

    name.value = 'Mexico';
    await flushMicrotasks();

    expect(screen.queryByRole('menuitem')).toBe(null);
  });

  it('matches the label in place of the rendered text', async () => {
    await render(
      <TestFilterDropdownRoot value="can">
        <Item label="Canada">Kanada</Item>
        <Item>Mexico</Item>
      </TestFilterDropdownRoot>,
    );
    await flushMicrotasks();

    expect(screen.getByRole('menuitem', { name: 'Kanada' })).toBeVisible();
    expect(screen.queryByRole('menuitem', { name: 'Mexico' })).toBe(null);
  });

  it('runs the filter again when a label changes that the item does not render', async () => {
    const label = shallowRef('Canada');
    const LabelItem = defineComponent(() => {
      const { visible, ref } = useFilterDropdownItem({ label });
      return () =>
        visible.value ? (
          <div role="menuitem" ref={(element) => ref(element as HTMLElement | null)}>
            North
          </div>
        ) : null;
    });
    await render(
      <TestFilterDropdownRoot value="can">
        <LabelItem />
      </TestFilterDropdownRoot>,
    );
    await flushMicrotasks();
    expect(screen.getByRole('menuitem', { name: 'North' })).toBeVisible();

    label.value = 'Kanada';
    await flushMicrotasks();

    expect(screen.queryByRole('menuitem')).toBe(null);
  });
});
