import { expect, vi, describe, it } from 'vitest';
import { defineComponent, KeepAlive, shallowRef } from 'vue';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  screen,
  takeReportedMessages,
} from '#test-utils';
import CompositeItem from '../../../../test/fixtures/CompositeItemPart.vue';
import CompositeListItemPart from '../../../../test/fixtures/CompositeListItemPart.vue';
import CompositeRoot from '../../../../test/fixtures/CompositeRootPart.vue';
import { DirectionProvider } from '../../../direction-provider';
import type { TextDirection } from '../../../direction-provider';
import { useCompositeRootContext } from './CompositeRootContext';
import { gridNavigation } from './gridNavigation';
import { useCompositeRoot } from './useCompositeRoot';

async function pressKey(item: HTMLElement, key: string) {
  await fireEvent.keyDown(item, { key });
  await flushMicrotasks();
}

describe('useCompositeRoot', () => {
  const { render } = createRenderer();

  it('follows a change of the text direction', async () => {
    const direction = shallowRef<TextDirection>('ltr');

    const App = defineComponent(() => () => (
      <DirectionProvider direction={direction.value}>
        <CompositeRoot data-testid="root" orientation="horizontal">
          <CompositeListItemPart data-testid="1" />
          <CompositeListItemPart data-testid="2" />
          <CompositeListItemPart data-testid="3" />
        </CompositeRoot>
      </DirectionProvider>
    ));

    await render(<App />);

    const root = screen.getByTestId('root');
    expect(root).toHaveAttribute('data-highlighted-index', '0');

    await pressKey(screen.getByTestId('1'), 'ArrowRight');
    expect(root).toHaveAttribute('data-highlighted-index', '1');

    direction.value = 'rtl';
    await flushMicrotasks();

    await pressKey(screen.getByTestId('2'), 'ArrowLeft');
    expect(root).toHaveAttribute('data-highlighted-index', '2');
  });

  it('reads a parameter that changes after the mount', async () => {
    const { setProps } = await render(
      <CompositeRoot data-testid="root" loopFocus={false}>
        <CompositeListItemPart data-testid="1" />
        <CompositeListItemPart data-testid="2" />
        <CompositeListItemPart data-testid="3" />
      </CompositeRoot>,
    );

    const root = screen.getByTestId('root');
    expect(root).toHaveAttribute('data-highlighted-index', '0');

    await pressKey(screen.getByTestId('1'), 'ArrowLeft');
    expect(root).toHaveAttribute('data-highlighted-index', '0');

    await setProps({ loopFocus: true });

    await pressKey(screen.getByTestId('1'), 'ArrowLeft');
    expect(root).toHaveAttribute('data-highlighted-index', '2');
  });

  it('moves its own highlight when it has a change callback and no highlighted index', async () => {
    const onHighlightedIndexChange = vi.fn();

    await render(
      <CompositeRoot data-testid="root" onHighlightedIndexChange={onHighlightedIndexChange}>
        <CompositeListItemPart data-testid="1" />
        <CompositeListItemPart data-testid="2" />
      </CompositeRoot>,
    );

    const root = screen.getByTestId('root');
    expect(root).toHaveAttribute('data-highlighted-index', '0');
    expect(onHighlightedIndexChange).not.toHaveBeenCalled();

    await pressKey(screen.getByTestId('1'), 'ArrowRight');

    expect(onHighlightedIndexChange).toHaveBeenCalledExactlyOnceWith(1);
    expect(root).toHaveAttribute('data-highlighted-index', '1');
  });

  it('moves the highlight off an index that becomes disabled after the mount', async () => {
    const { setProps } = await render(
      <CompositeRoot data-testid="root" disabledIndices={[]}>
        <CompositeListItemPart data-testid="1" />
        <CompositeListItemPart data-testid="2" />
        <CompositeListItemPart data-testid="3" />
      </CompositeRoot>,
    );

    const root = screen.getByTestId('root');
    expect(root).toHaveAttribute('data-highlighted-index', '0');

    await setProps({ disabledIndices: [0] });
    await flushMicrotasks();

    expect(root).toHaveAttribute('data-highlighted-index', '1');
  });

  it('reads a grid configuration that changes after the mount', async () => {
    const cols = shallowRef(2);

    const App = defineComponent(() => {
      const { props: compositeProps, rootRef } = useCompositeRoot({
        grid: gridNavigation(() => ({ cols: cols.value })),
      });

      return () => (
        <div {...compositeProps} ref={(node: unknown) => rootRef(node as HTMLElement | null)}>
          <CompositeItem data-testid="1" />
          <CompositeItem data-testid="2" />
          <CompositeItem data-testid="3" />
          <CompositeItem data-testid="4" />
        </div>
      );
    });

    await render(<App />);

    const item1 = screen.getByTestId('1');
    item1.focus();
    await flushMicrotasks();

    await pressKey(item1, 'ArrowDown');
    expect(screen.getByTestId('3')).toHaveFocus();

    cols.value = 4;
    item1.focus();
    await flushMicrotasks();

    // The grid has one row. It does not move the highlight, and the list step moves it.
    await pressKey(item1, 'ArrowDown');
    expect(screen.getByTestId('2')).toHaveFocus();
  });

  describe('KeepAlive', () => {
    it('keeps the highlighted index when the root is active again', async () => {
      const Other = defineComponent(() => () => <span data-testid="other" />);

      const App = defineComponent(
        (props: { visible: boolean }) => () => (
          <KeepAlive>
            {props.visible ? (
              <CompositeRoot data-testid="root">
                <CompositeListItemPart data-testid="1" />
                <CompositeListItemPart data-testid="2" />
                <CompositeListItemPart data-testid="3" />
              </CompositeRoot>
            ) : (
              <Other />
            )}
          </KeepAlive>
        ),
        { props: ['visible'] },
      );

      const { setProps } = await render(<App visible />);

      const root = screen.getByTestId('root');
      const items = ['1', '2', '3'].map((testId) => screen.getByTestId(testId));
      expect(root).toHaveAttribute('data-highlighted-index', '0');

      await pressKey(items[0], 'ArrowRight');
      await pressKey(items[1], 'ArrowRight');
      expect(root).toHaveAttribute('data-highlighted-index', '2');

      await setProps({ visible: false });
      await flushMicrotasks();
      expect(screen.getByTestId('other')).toBeInTheDocument();
      expect(root).not.toBeInTheDocument();

      await setProps({ visible: true });
      await flushMicrotasks();
      expect(root).toBeInTheDocument();
      expect(root).toHaveAttribute('data-highlighted-index', '2');

      await pressKey(items[2], 'ArrowLeft');
      expect(root).toHaveAttribute('data-highlighted-index', '1');
    });

    it('moves the highlight off an index that becomes disabled while the root is inactive', async () => {
      const Other = defineComponent(() => () => <span data-testid="other" />);

      const App = defineComponent(
        (props: { visible: boolean; disabledIndices: number[] }) => () => (
          <KeepAlive>
            {props.visible ? (
              <CompositeRoot data-testid="root" disabledIndices={props.disabledIndices}>
                <CompositeListItemPart data-testid="1" />
                <CompositeListItemPart data-testid="2" />
                <CompositeListItemPart data-testid="3" />
              </CompositeRoot>
            ) : (
              <Other />
            )}
          </KeepAlive>
        ),
        { props: ['visible', 'disabledIndices'] },
      );

      const { setProps } = await render(<App visible disabledIndices={[]} />);

      const root = screen.getByTestId('root');
      const items = ['1', '2', '3'].map((testId) => screen.getByTestId(testId));

      await pressKey(items[0], 'ArrowRight');
      await pressKey(items[1], 'ArrowRight');
      expect(root).toHaveAttribute('data-highlighted-index', '2');

      await setProps({ visible: false });
      await flushMicrotasks();
      expect(root).not.toBeInTheDocument();

      await setProps({ visible: true, disabledIndices: [2] });
      await flushMicrotasks();

      expect(root).toHaveAttribute('data-highlighted-index', '0');
    });
  });

  // This case is the last one of the file. In Vue 3.5.0, a `setup` that throws leaves the current
  // instance set, and each later case of the file then gets a warning about a slot.
  describe('useCompositeRootContext', () => {
    it('throws when there is no composite root', async () => {
      const Item = defineComponent(() => {
        useCompositeRootContext();
        return () => null;
      });

      await expect(render(<Item />)).rejects.toThrow(
        'Vase UI: A composite item must be inside a composite root. Without a root the item has no highlighted index and no tab stop. Put the item part inside its root part.',
      );

      // Vue also warns about the error of `setup`.
      expect(takeReportedMessages()).toEqual([
        expect.stringContaining('Unhandled error during execution of setup function'),
      ]);
    });
  });
});
