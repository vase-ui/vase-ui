import { expect, vi, describe, it } from 'vitest';
import { computed, defineComponent, shallowRef } from 'vue';
import type { Ref } from 'vue';
import { createRenderer, fireEvent, flushMicrotasks, screen, waitFor } from '#test-utils';
import CompositeItem from '../../../../test/fixtures/CompositeItemPart.vue';
import CompositeRoot from '../../../../test/fixtures/CompositeRootPart.vue';
import { DirectionProvider } from '../../../direction-provider';
import type { HTMLProps } from '../../types';
import type { CompositeMetadata } from '../list/useCompositeList';
import { useCompositeListItem } from '../list/useCompositeListItem';

// Vue types a template ref as an element, a component or `null`.
function bindRef(ref: (node: HTMLElement | null) => void) {
  return (node: unknown) => ref(node as HTMLElement | null);
}

describe('Composite', () => {
  const { render } = createRenderer();
  const gridItems = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  const IndexedItem = defineComponent(
    (props: { index: number; active?: boolean | undefined; testId: string }) => {
      const { ref } = useCompositeListItem({ index: () => props.index });
      return () => (
        <div
          ref={bindRef(ref)}
          data-testid={props.testId}
          data-composite-item-active={props.active ? '' : undefined}
        />
      );
    },
    { props: ['index', 'active', 'testId'] },
  );

  function TestGridItems() {
    return (
      <>
        {gridItems.map((i) => (
          <CompositeItem key={i} data-testid={i}>
            {i}
          </CompositeItem>
        ))}
      </>
    );
  }

  describe('list', () => {
    it('does not add aria-orientation when orientation is set', async () => {
      const { container } = await render(
        <CompositeRoot orientation="horizontal">
          <CompositeItem>1</CompositeItem>
          <CompositeItem>2</CompositeItem>
        </CompositeRoot>,
      );

      expect(container.firstElementChild as HTMLElement).not.toHaveAttribute('aria-orientation');
    });

    it('controlled mode', async () => {
      const App = defineComponent(() => {
        const highlightedIndex = shallowRef(0);
        return () => (
          <CompositeRoot
            highlightedIndex={highlightedIndex.value}
            onHighlightedIndexChange={(index: number) => {
              highlightedIndex.value = index;
            }}
          >
            <CompositeItem data-testid="1">1</CompositeItem>
            <CompositeItem data-testid="2">2</CompositeItem>
            <CompositeItem data-testid="3">3</CompositeItem>
          </CompositeRoot>
        );
      });

      await render(<App />);

      const item1 = screen.getByTestId('1');
      const item2 = screen.getByTestId('2');
      const item3 = screen.getByTestId('3');

      item1.focus();
      await flushMicrotasks();

      expect(item1).toHaveAttribute('tabindex', '0');

      await fireEvent.keyDown(item1, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item2).toHaveAttribute('tabindex', '0');
      expect(item2).toHaveFocus();

      await fireEvent.keyDown(item2, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item3).toHaveAttribute('tabindex', '0');
      expect(item3).toHaveFocus();

      await fireEvent.keyDown(item3, { key: 'ArrowUp' });
      await flushMicrotasks();

      expect(item2).toHaveAttribute('tabindex', '0');
      expect(item2).toHaveFocus();

      await fireEvent.keyDown(item2, { key: 'ArrowUp' });
      await flushMicrotasks();

      expect(item1).toHaveAttribute('tabindex', '0');
      expect(item1).toHaveFocus();
    });

    it('uncontrolled mode', async () => {
      await render(
        <CompositeRoot>
          <CompositeItem data-testid="1">1</CompositeItem>
          <CompositeItem data-testid="2">2</CompositeItem>
          <CompositeItem data-testid="3">3</CompositeItem>
        </CompositeRoot>,
      );

      const item1 = screen.getByTestId('1');
      const item2 = screen.getByTestId('2');
      const item3 = screen.getByTestId('3');

      item1.focus();
      await flushMicrotasks();

      await fireEvent.keyDown(item1, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item2).toHaveAttribute('tabindex', '0');
      expect(item2).toHaveFocus();

      await fireEvent.keyDown(item2, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item3).toHaveAttribute('tabindex', '0');
      expect(item3).toHaveFocus();

      await fireEvent.keyDown(item3, { key: 'ArrowUp' });
      await flushMicrotasks();

      expect(item2).toHaveAttribute('tabindex', '0');
      expect(item2).toHaveFocus();

      await fireEvent.keyDown(item2, { key: 'ArrowUp' });
      await flushMicrotasks();

      expect(item1).toHaveAttribute('tabindex', '0');
      expect(item1).toHaveFocus();
    });

    it('uses an active item explicit index as the initial highlighted index', async () => {
      const onHighlightedIndexChange = vi.fn();

      await render(
        <CompositeRoot highlightedIndex={0} onHighlightedIndexChange={onHighlightedIndexChange}>
          <IndexedItem testId="two" index={2} active />
          <IndexedItem testId="zero" index={0} />
          <IndexedItem testId="one" index={1} />
        </CompositeRoot>,
      );

      expect(onHighlightedIndexChange).toHaveBeenCalledWith(2);
    });

    it('keeps native input behavior when the native target differs from the synthetic target', async () => {
      await render(
        <CompositeRoot orientation="horizontal">
          <CompositeItem data-testid="1">1</CompositeItem>
          <div data-testid="host" />
          <CompositeItem data-testid="2">2</CompositeItem>
        </CompositeRoot>,
      );

      const item1 = screen.getByTestId('1');
      const item2 = screen.getByTestId('2');
      const host = screen.getByTestId('host');
      const input = document.createElement('input');

      input.type = 'text';
      input.value = 'abcd';
      input.setSelectionRange(2, 2);

      const focusEvent = new FocusEvent('focusin', { bubbles: true });
      Object.defineProperty(focusEvent, 'composedPath', {
        configurable: true,
        value: () => [input, host],
      });

      await fireEvent(host, focusEvent);

      // A native input in a composite selects its whole value when it gets focus. The first arrow
      // key then clears the selection in the input, and the next arrow key can move focus.
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(4);

      item1.focus();
      await flushMicrotasks();

      input.setSelectionRange(1, 1);

      const keyDownEvent = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(keyDownEvent, 'composedPath', {
        configurable: true,
        value: () => [input, host],
      });

      await fireEvent(host, keyDownEvent);
      await flushMicrotasks();

      expect(item1).toHaveFocus();
      expect(item2).not.toHaveFocus();
    });

    it.each([
      { orientation: 'horizontal' as const, key: 'ArrowRight', prevented: true },
      { orientation: 'horizontal' as const, key: 'ArrowDown', prevented: false },
      { orientation: 'vertical' as const, key: 'ArrowDown', prevented: true },
      { orientation: 'vertical' as const, key: 'ArrowRight', prevented: false },
      { orientation: 'both' as const, key: 'ArrowRight', prevented: true },
      { orientation: 'both' as const, key: 'ArrowDown', prevented: true },
    ])(
      'sets default prevention to $prevented for $key with $orientation orientation',
      async ({ orientation, key, prevented }) => {
        await render(
          <CompositeRoot orientation={orientation}>
            <CompositeItem data-testid="1">1</CompositeItem>
            <CompositeItem data-testid="2">2</CompositeItem>
          </CompositeRoot>,
        );

        const item1 = screen.getByTestId('1');
        item1.focus();
        await flushMicrotasks();

        const allowed = await fireEvent.keyDown(item1, { key });
        await flushMicrotasks();

        expect(allowed).toBe(!prevented);
      },
    );

    it('updates the order of items', async () => {
      const App = defineComponent(
        (props: { items: string[] }) => () => (
          <CompositeRoot>
            {props.items.map((item) => (
              <CompositeItem key={item} data-testid={item}>
                {item}
              </CompositeItem>
            ))}
          </CompositeRoot>
        ),
        { props: ['items'] },
      );
      const { user, rerender } = await render(<App items={['1', '2', '3']} />);
      await rerender(<App items={['1', '3', '2']} />);

      const item1 = screen.getByTestId('1');
      const item3 = screen.getByTestId('3');

      item1.focus();
      await flushMicrotasks();
      await user.keyboard('{ArrowDown}');
      expect(item3).toHaveFocus();
    });

    it('updates the order of items when their containers are reordered', async () => {
      const App = defineComponent(
        (props: { groups: string[] }) => () => (
          <CompositeRoot>
            {props.groups.map((group) => (
              <div key={group} role="group">
                <CompositeItem data-testid={group}>{group}</CompositeItem>
              </div>
            ))}
          </CompositeRoot>
        ),
        { props: ['groups'] },
      );
      // A move of a container moves its item and calls no ref callback. Only the
      // `MutationObserver` of the list finds the new order.
      const { user, rerender } = await render(<App groups={['a', 'b', 'c']} />);
      await rerender(<App groups={['b', 'a', 'c']} />);

      const itemA = screen.getByTestId('a');
      const itemB = screen.getByTestId('b');

      // The `MutationObserver` sorts the list after the move. Then the tab stop (highlighted
      // index 0) is on the first item in the new DOM order.
      await waitFor(() => {
        expect(itemB).toHaveAttribute('tabindex', '0');
      });

      itemB.focus();
      await flushMicrotasks();
      await user.keyboard('{ArrowDown}');
      expect(itemA).toHaveFocus();
    });

    describe('Home and End keys', () => {
      it('Home key moves focus to the first item', async () => {
        await render(
          <CompositeRoot enableHomeAndEndKeys>
            <CompositeItem data-testid="1">1</CompositeItem>
            <CompositeItem data-testid="2">2</CompositeItem>
            <CompositeItem data-testid="3">3</CompositeItem>
          </CompositeRoot>,
        );

        const item1 = screen.getByTestId('1');
        const item3 = screen.getByTestId('3');

        item3.focus();
        await flushMicrotasks();

        await fireEvent.keyDown(item3, { key: 'Home' });
        await flushMicrotasks();

        expect(item1).toHaveAttribute('tabindex', '0');
        expect(item1).toHaveFocus();
      });

      it('End key moves focus to the last item', async () => {
        await render(
          <CompositeRoot enableHomeAndEndKeys>
            <CompositeItem data-testid="1">1</CompositeItem>
            <CompositeItem data-testid="2">2</CompositeItem>
            <CompositeItem data-testid="3">3</CompositeItem>
          </CompositeRoot>,
        );

        const item1 = screen.getByTestId('1');
        const item3 = screen.getByTestId('3');

        item1.focus();
        await flushMicrotasks();

        await fireEvent.keyDown(item1, { key: 'End' });
        await flushMicrotasks();

        expect(item3).toHaveAttribute('tabindex', '0');
        expect(item3).toHaveFocus();
      });
    });

    it('calls onLoop and uses its return value', async () => {
      const onLoop = vi.fn(
        (
          _event: KeyboardEvent,
          _prevIndex: number,
          _nextIndex: number,
          _elementsRef: Readonly<Ref<ReadonlyArray<HTMLElement | null>>>,
        ) => 1,
      );

      function App() {
        return (
          <CompositeRoot onLoop={onLoop}>
            <TestGridItems />
          </CompositeRoot>
        );
      }

      await render(<App />);

      screen.getByTestId('9').focus();
      await flushMicrotasks();

      await fireEvent.keyDown(screen.getByTestId('9'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(onLoop).toHaveBeenCalledOnce();

      const [event, prevIndex, nextIndex, elementsRef] = onLoop.mock.calls[0]!;
      expect(event.key).toBe('ArrowDown');
      expect(prevIndex).toBe(8);
      expect(nextIndex).toBe(0);
      expect(elementsRef.value[8]).toBe(screen.getByTestId('9'));
      expect(screen.getByTestId('2')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('2')).toHaveFocus();
    });

    it('does not loop or call onLoop when loopFocus is disabled', async () => {
      const onLoop = vi.fn(
        (
          _event: KeyboardEvent,
          _prevIndex: number,
          nextIndex: number,
          _elementsRef: Readonly<Ref<ReadonlyArray<HTMLElement | null>>>,
        ) => nextIndex,
      );

      await render(
        <CompositeRoot loopFocus={false} onLoop={onLoop}>
          <TestGridItems />
        </CompositeRoot>,
      );

      screen.getByTestId('9').focus();
      await flushMicrotasks();

      await fireEvent.keyDown(screen.getByTestId('9'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(onLoop).not.toHaveBeenCalled();
      expect(screen.getByTestId('9')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('9')).toHaveFocus();
    });

    describe('rtl', () => {
      it('horizontal orientation', async () => {
        await render(
          <div dir="rtl">
            <DirectionProvider direction="rtl">
              <CompositeRoot orientation="horizontal">
                <CompositeItem data-testid="1">1</CompositeItem>
                <CompositeItem data-testid="2">2</CompositeItem>
                <CompositeItem data-testid="3">3</CompositeItem>
              </CompositeRoot>
            </DirectionProvider>
          </div>,
        );

        const item1 = screen.getByTestId('1');
        const item2 = screen.getByTestId('2');
        const item3 = screen.getByTestId('3');

        item1.focus();
        await flushMicrotasks();

        await fireEvent.keyDown(item1, { key: 'ArrowDown' });
        await flushMicrotasks();

        await fireEvent.keyDown(item1, { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(item2).toHaveAttribute('tabindex', '0');
        expect(item2).toHaveFocus();

        await fireEvent.keyDown(item2, { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(item3).toHaveAttribute('tabindex', '0');
        expect(item3).toHaveFocus();

        await fireEvent.keyDown(item3, { key: 'ArrowRight' });
        await flushMicrotasks();

        expect(item2).toHaveAttribute('tabindex', '0');
        expect(item2).toHaveFocus();

        await fireEvent.keyDown(item2, { key: 'ArrowRight' });
        await flushMicrotasks();

        expect(item1).toHaveAttribute('tabindex', '0');
        expect(item1).toHaveFocus();

        // Loop backward.
        await fireEvent.keyDown(item1, { key: 'ArrowRight' });
        await flushMicrotasks();

        expect(item3).toHaveAttribute('tabindex', '0');
        expect(item3).toHaveFocus();
      });

      it('both horizontal and vertical orientation', async () => {
        await render(
          <div dir="rtl">
            <DirectionProvider direction="rtl">
              <CompositeRoot orientation="both">
                <CompositeItem data-testid="1">1</CompositeItem>
                <CompositeItem data-testid="2">2</CompositeItem>
                <CompositeItem data-testid="3">3</CompositeItem>
              </CompositeRoot>
            </DirectionProvider>
          </div>,
        );

        const item1 = screen.getByTestId('1');
        const item2 = screen.getByTestId('2');
        const item3 = screen.getByTestId('3');

        item1.focus();
        await flushMicrotasks();

        await fireEvent.keyDown(item1, { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(item2).toHaveAttribute('tabindex', '0');
        expect(item2).toHaveFocus();

        await fireEvent.keyDown(item2, { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(item3).toHaveAttribute('tabindex', '0');
        expect(item3).toHaveFocus();

        await fireEvent.keyDown(item3, { key: 'ArrowRight' });
        await flushMicrotasks();

        expect(item2).toHaveAttribute('tabindex', '0');
        expect(item2).toHaveFocus();

        await fireEvent.keyDown(item2, { key: 'ArrowRight' });
        await flushMicrotasks();

        expect(item1).toHaveAttribute('tabindex', '0');
        expect(item1).toHaveFocus();

        await fireEvent.keyDown(item1, { key: 'ArrowDown' });
        await flushMicrotasks();

        expect(item2).toHaveAttribute('tabindex', '0');
        expect(item2).toHaveFocus();

        await fireEvent.keyDown(item2, { key: 'ArrowDown' });
        await flushMicrotasks();

        expect(item3).toHaveAttribute('tabindex', '0');
        expect(item3).toHaveFocus();
      });
    });
  });

  describe('prop: disabledIndices', () => {
    it('moves the initial tab stop to the first enabled item when the default item is disabled', async () => {
      await render(
        <CompositeRoot disabledIndices={[0]}>
          <CompositeItem data-testid="1" />
          <CompositeItem data-testid="2" />
          <CompositeItem data-testid="3" />
        </CompositeRoot>,
      );

      expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '-1');
      expect(screen.getByTestId('2')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('3')).toHaveAttribute('tabindex', '-1');
    });

    it('keeps the initial tab stop when all items are disabled', async () => {
      await render(
        <CompositeRoot disabledIndices={[0, 1]}>
          <CompositeItem data-testid="1" />
          <CompositeItem data-testid="2" />
        </CompositeRoot>,
      );

      expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('2')).toHaveAttribute('tabindex', '-1');
    });

    it('disables navigating item when their index is included', async () => {
      const App = defineComponent(() => {
        const highlightedIndex = shallowRef(0);
        return () => (
          <CompositeRoot
            highlightedIndex={highlightedIndex.value}
            onHighlightedIndexChange={(index: number) => {
              highlightedIndex.value = index;
            }}
            disabledIndices={[1]}
          >
            <CompositeItem data-testid="1" />
            <CompositeItem data-testid="2" />
            <CompositeItem data-testid="3" />
          </CompositeRoot>
        );
      });

      await render(<App />);

      const item1 = screen.getByTestId('1');
      const item3 = screen.getByTestId('3');

      item1.focus();
      await flushMicrotasks();

      await fireEvent.keyDown(item1, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item3).toHaveAttribute('tabindex', '0');
      expect(item3).toHaveFocus();

      await fireEvent.keyDown(item3, { key: 'ArrowUp' });
      await flushMicrotasks();

      expect(item1).toHaveAttribute('tabindex', '0');
      expect(item1).toHaveFocus();
    });

    it('allows navigating items disabled in the DOM when their index is excluded', async () => {
      // TS does not know the disabled attribute of a non-interactive element, but testing library
      // refuses to focus a disabled interactive element.
      const renderDisabledSpan = ({ props }: { props: HTMLProps }) => (
        // @ts-expect-error A span has no disabled prop; exercise focus on an aria-disabled non-interactive element.
        <span {...props} data-disabled aria-disabled="true" disabled />
      );

      const App = defineComponent(() => {
        const highlightedIndex = shallowRef(0);
        return () => (
          <CompositeRoot
            highlightedIndex={highlightedIndex.value}
            onHighlightedIndexChange={(index: number) => {
              highlightedIndex.value = index;
            }}
            disabledIndices={[]}
          >
            <CompositeItem data-testid="1" v-slots={{ render: renderDisabledSpan }} />
            <CompositeItem data-testid="2" v-slots={{ render: renderDisabledSpan }} />
            <CompositeItem data-testid="3" v-slots={{ render: renderDisabledSpan }} />
          </CompositeRoot>
        );
      });

      await render(<App />);

      const item1 = screen.getByTestId('1');
      const item2 = screen.getByTestId('2');
      const item3 = screen.getByTestId('3');

      item1.focus();
      await flushMicrotasks();

      await fireEvent.keyDown(item1, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item2).toHaveAttribute('tabindex', '0');
      expect(item2).toHaveFocus();

      await fireEvent.keyDown(item2, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item3).toHaveAttribute('tabindex', '0');
      expect(item3).toHaveFocus();

      await fireEvent.keyDown(item3, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item1).toHaveAttribute('tabindex', '0');
      expect(item1).toHaveFocus();

      await fireEvent.keyDown(item1, { key: 'ArrowUp' });
      await flushMicrotasks();

      expect(item3).toHaveAttribute('tabindex', '0');
      expect(item3).toHaveFocus();
    });
  });

  describe('item removal', () => {
    it('keeps the tab stop on the highlighted item when an earlier item is removed', async () => {
      const App = defineComponent(
        (props: { showFirst: boolean }) => () => (
          <CompositeRoot>
            {props.showFirst && <CompositeItem data-testid="1" />}
            <CompositeItem data-testid="2" />
            <CompositeItem data-testid="3" />
            <CompositeItem data-testid="4" />
          </CompositeRoot>
        ),
        { props: ['showFirst'] },
      );

      const { setProps } = await render(<App showFirst />);

      const item1 = screen.getByTestId('1');
      item1.focus();
      await flushMicrotasks();

      await fireEvent.keyDown(item1, { key: 'ArrowDown' });
      await flushMicrotasks();

      await fireEvent.keyDown(screen.getByTestId('2'), { key: 'ArrowDown' });
      await flushMicrotasks();

      const item3 = screen.getByTestId('3');
      expect(item3).toHaveAttribute('tabindex', '0');

      await setProps({ showFirst: false });

      expect(item3).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('2')).toHaveAttribute('tabindex', '-1');
      expect(screen.getByTestId('4')).toHaveAttribute('tabindex', '-1');

      // Navigation continues from the item that holds the tab stop.
      await fireEvent.keyDown(item3, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(screen.getByTestId('4')).toHaveFocus();
    });

    it('moves the tab stop back into range when the highlighted item is removed', async () => {
      const App = defineComponent(
        (props: { showLast: boolean }) => () => (
          <CompositeRoot>
            <CompositeItem data-testid="1" />
            <CompositeItem data-testid="2" />
            {props.showLast && <CompositeItem data-testid="3" />}
          </CompositeRoot>
        ),
        { props: ['showLast'] },
      );

      const { setProps } = await render(<App showLast />);

      const item1 = screen.getByTestId('1');
      item1.focus();
      await flushMicrotasks();

      await fireEvent.keyDown(item1, { key: 'ArrowDown' });
      await flushMicrotasks();

      await fireEvent.keyDown(screen.getByTestId('2'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(screen.getByTestId('3')).toHaveAttribute('tabindex', '0');

      await setProps({ showLast: false });

      expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('2')).toHaveAttribute('tabindex', '-1');
    });

    it('moves the tab stop to the active item when the highlighted item is removed', async () => {
      const App = defineComponent(
        (props: { showLast: boolean }) => () => (
          <CompositeRoot>
            <CompositeItem data-testid="1" />
            <CompositeItem data-testid="2" />
            <CompositeItem data-testid="3" data-composite-item-active="" />
            {props.showLast && <CompositeItem data-testid="4" />}
          </CompositeRoot>
        ),
        { props: ['showLast'] },
      );

      const { setProps } = await render(<App showLast />);

      const item3 = screen.getByTestId('3');
      expect(item3).toHaveAttribute('tabindex', '0');

      item3.focus();
      await flushMicrotasks();

      await fireEvent.keyDown(item3, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(screen.getByTestId('4')).toHaveAttribute('tabindex', '0');

      await setProps({ showLast: false });

      expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '-1');
      expect(item3).toHaveAttribute('tabindex', '0');
    });

    it('skips items that cannot hold the tab stop', async () => {
      const App = defineComponent(
        (props: { showLast: boolean }) => () => (
          <CompositeRoot>
            <CompositeItem data-testid="1" style={{ display: 'none' }} />
            <CompositeItem data-testid="2" aria-disabled="true" />
            <CompositeItem data-testid="3" />
            {props.showLast && <CompositeItem data-testid="4" />}
          </CompositeRoot>
        ),
        { props: ['showLast'] },
      );

      const { setProps } = await render(<App showLast />);

      const item3 = screen.getByTestId('3');
      expect(item3).toHaveAttribute('tabindex', '0');

      item3.focus();
      await flushMicrotasks();

      await fireEvent.keyDown(item3, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(screen.getByTestId('4')).toHaveAttribute('tabindex', '0');

      await setProps({ showLast: false });

      expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '-1');
      expect(screen.getByTestId('2')).toHaveAttribute('tabindex', '-1');
      expect(item3).toHaveAttribute('tabindex', '0');
    });

    it('keeps the tab stop in range when no item can hold it', async () => {
      const App = defineComponent(
        (props: { showLast: boolean }) => () => (
          <CompositeRoot>
            <CompositeItem data-testid="1" aria-disabled="true" />
            <CompositeItem data-testid="2" aria-disabled="true" />
            {props.showLast && <CompositeItem data-testid="3" />}
          </CompositeRoot>
        ),
        { props: ['showLast'] },
      );

      const { setProps } = await render(<App showLast />);

      expect(screen.getByTestId('3')).toHaveAttribute('tabindex', '0');

      await setProps({ showLast: false });

      expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('2')).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('prop: modifierKeys', () => {
    it('prevents arrow key navigation when any modifier key is pressed by default', async () => {
      await render(
        <CompositeRoot>
          <CompositeItem data-testid="1">1</CompositeItem>
          <CompositeItem data-testid="2">2</CompositeItem>
        </CompositeRoot>,
      );

      const item1 = screen.getByTestId('1');

      item1.focus();
      await flushMicrotasks();

      expect(item1).toHaveFocus();

      await fireEvent.keyDown(item1, { key: 'ArrowDown', shiftKey: true });
      await flushMicrotasks();
      expect(item1).toHaveFocus();

      await fireEvent.keyDown(item1, { key: 'ArrowDown', ctrlKey: true });
      await flushMicrotasks();
      expect(item1).toHaveFocus();

      await fireEvent.keyDown(item1, { key: 'ArrowDown', altKey: true });
      await flushMicrotasks();
      expect(item1).toHaveFocus();

      await fireEvent.keyDown(item1, { key: 'ArrowDown', metaKey: true });
      await flushMicrotasks();
      expect(item1).toHaveFocus();
    });

    it('specifies allowed modifier keys that do not prevent arrow key navigation when pressed', async () => {
      await render(
        <CompositeRoot modifierKeys={['Alt', 'Meta']}>
          <CompositeItem data-testid="1">1</CompositeItem>
          <CompositeItem data-testid="2">2</CompositeItem>
          <CompositeItem data-testid="3">3</CompositeItem>
        </CompositeRoot>,
      );

      const item1 = screen.getByTestId('1');
      const item2 = screen.getByTestId('2');
      const item3 = screen.getByTestId('3');

      item1.focus();
      await flushMicrotasks();

      expect(item1).toHaveFocus();

      await fireEvent.keyDown(item1, { key: 'ArrowDown', shiftKey: true });
      await flushMicrotasks();
      expect(item1).toHaveFocus();

      await fireEvent.keyDown(item1, { key: 'ArrowDown', ctrlKey: true });
      await flushMicrotasks();
      expect(item1).toHaveFocus();

      await fireEvent.keyDown(item1, { key: 'ArrowDown', altKey: true });
      await flushMicrotasks();
      expect(item2).toHaveFocus();

      await fireEvent.keyDown(item2, { key: 'ArrowDown', metaKey: true });
      await flushMicrotasks();
      expect(item3).toHaveFocus();
    });
  });
});

type NestedItemMetadata = {
  disabled: boolean;
  focusableWhenDisabled: boolean;
};

const FOCUSABLE_DISABLED: NestedItemMetadata = {
  disabled: true,
  focusableWhenDisabled: true,
};

const UNFOCUSABLE_DISABLED: NestedItemMetadata = {
  disabled: true,
  focusableWhenDisabled: false,
};

// The wrapper renders an inner item with the attributes that the outer item gives it, so the two
// items share one element. The `ref` of the inner part gives the element to the outer item.
const NestedItem = defineComponent(
  (_props: object, { attrs, expose }) => {
    const element = shallowRef<HTMLElement | null>(null);
    expose({ element });

    return () => (
      <CompositeItem
        as="button"
        metadata={UNFOCUSABLE_DISABLED}
        {...attrs}
        ref={(part: unknown) => {
          element.value = (part as { element: HTMLElement | null } | null)?.element ?? null;
        }}
      />
    );
  },
  { inheritAttrs: false },
);

const NestedItemsRoot = defineComponent(() => {
  const itemMap = shallowRef(new Map<Node, CompositeMetadata<NestedItemMetadata>>());
  const disabledIndices = computed(() => {
    const output: number[] = [];

    itemMap.value.forEach((metadata) => {
      if (metadata.disabled && !metadata.focusableWhenDisabled) {
        output.push(metadata.index);
      }
    });

    return output;
  });

  return () => (
    <CompositeRoot
      orientation="horizontal"
      disabledIndices={disabledIndices.value}
      onMapChange={(map) => {
        itemMap.value = map;
      }}
    >
      <CompositeItem as="button" metadata={FOCUSABLE_DISABLED} data-testid="first" />
      <CompositeItem
        v-slots={{
          render: ({ props }: { props: HTMLProps }) => (
            <NestedItem {...props} data-testid="second" />
          ),
        }}
        metadata={FOCUSABLE_DISABLED}
      />
      <CompositeItem
        v-slots={{
          render: ({ props }: { props: HTMLProps }) => (
            <NestedItem {...props} data-testid="third" />
          ),
        }}
        metadata={FOCUSABLE_DISABLED}
      />
    </CompositeRoot>
  );
});

const DynamicNestedItem = defineComponent(
  (props: { revision: number }, { attrs, expose }) => {
    const element = shallowRef<HTMLElement | null>(null);
    expose({ element });
    // Only the data of the inner item changes. The data of the outer item stays the same.
    const metadata = computed(() => ({ ...UNFOCUSABLE_DISABLED, revision: props.revision }));

    return () => (
      <CompositeItem
        as="button"
        metadata={metadata.value}
        {...attrs}
        ref={(part: unknown) => {
          element.value = (part as { element: HTMLElement | null } | null)?.element ?? null;
        }}
      />
    );
  },
  { props: ['revision'], inheritAttrs: false },
);

const DynamicNestedRoot = defineComponent(
  (props: { onMapChange: (map: Map<Node, any>) => void }) => {
    const revision = shallowRef(0);

    return () => (
      <>
        <button
          type="button"
          onClick={() => {
            revision.value += 1;
          }}
        >
          Update inner
        </button>
        <CompositeRoot orientation="horizontal" onMapChange={props.onMapChange}>
          <CompositeItem
            v-slots={{
              render: ({ props: itemProps }: { props: HTMLProps }) => (
                <DynamicNestedItem {...itemProps} data-testid="shared" revision={revision.value} />
              ),
            }}
            metadata={FOCUSABLE_DISABLED}
          />
        </CompositeRoot>
      </>
    );
  },
  { props: ['onMapChange'] },
);

describe('nested Composite items (strict: %s)', () => {
  const { render } = createRenderer();

  it('keeps outer metadata and focus navigation when items share a DOM node', async () => {
    const { user } = await render(<NestedItemsRoot />);
    const first = screen.getByTestId('first');
    const second = screen.getByTestId('second');
    const third = screen.getByTestId('third');

    await user.tab();
    expect(first).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(second).toHaveFocus();
    });

    await user.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(third).toHaveFocus();
    });
  });

  it('keeps the outer registration when only the inner item updates', async () => {
    const onMapChange = vi.fn();
    const { user } = await render(<DynamicNestedRoot onMapChange={onMapChange} />);
    const shared = screen.getByTestId('shared');
    const publishedMetadata = () =>
      (onMapChange.mock.lastCall?.[0] as Map<Node, NestedItemMetadata>)?.get(shared);

    // Both items register the same node. The outer ref comes last and owns the entry.
    expect(publishedMetadata()).toMatchObject({ focusableWhenDisabled: true });

    // An update of only the inner item must not give it the entry. The order of the ref calls
    // decides which item owns the entry, so the inner item cannot publish again on its own.
    await user.click(screen.getByRole('button', { name: 'Update inner' }));

    expect(publishedMetadata()).toMatchObject({ focusableWhenDisabled: true });
  });
});
