import { describe, expect, it, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import { createRenderer, fireEvent, screen, useTestInteractions, waitFor } from '#test-utils';
import { useFloating } from '../../../../test/floating-ui-tests/useFloating';
import { useClick } from './useClick';
import { useListNavigation } from './useListNavigation';

vi.mock('../../../common/platform', async () => {
  const actual = await vi.importActual<typeof import('../../../common/platform')>(
    '../../../common/platform',
  );

  return {
    ...actual,
    platform: {
      ...actual.platform,
      engine: { ...actual.platform.engine, webkit: true },
    },
  };
});

const { render } = createRenderer();

const App = defineComponent(() => {
  const open = shallowRef(false);
  const listRef = shallowRef<(HTMLLIElement | null)[]>([]);
  const activeIndex = shallowRef<null | number>(null);
  const { refs, context } = useFloating({
    open,
    onOpenChange(nextOpen) {
      open.value = nextOpen;
    },
  });
  const { getReferenceProps, getFloatingProps, getItemProps } = useTestInteractions([
    useClick(context.rootStore),
    useListNavigation(context.rootStore, {
      listRef,
      activeIndex,
      onNavigate(index) {
        activeIndex.value = index;
      },
    }),
  ]);

  return () => (
    <>
      <button {...getReferenceProps({ ref: refs.setReference })} />
      {open.value && (
        <div role="menu" {...getFloatingProps({ ref: refs.setFloating })}>
          <ul>
            {['one', 'two', 'three'].map((string, index) => (
              <li
                data-testid={`item-${index}`}
                aria-selected={activeIndex.value === index}
                key={string}
                tabindex={-1}
                {...getItemProps({
                  ref(node) {
                    listRef.value[index] = node as HTMLLIElement | null;
                  },
                })}
              >
                {string}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
});

describe('useListNavigation (WebKit)', () => {
  it('ignores stationary mousemove events fired when the list scrolls beneath the pointer', async () => {
    await render(<App />);

    await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
    await waitFor(() => {
      expect(screen.getByTestId('item-0')).toHaveFocus();
    });

    // WebKit fires a `mousemove` event with zero movement deltas on the item
    // that moves under the stationary pointer during a keyboard-driven scroll.
    await fireEvent.mouseMove(screen.getByTestId('item-1'));
    expect(screen.getByTestId('item-0')).toHaveFocus();
    expect(screen.getByTestId('item-1')).toHaveAttribute('aria-selected', 'false');

    // An actual pointer movement still moves the highlight.
    await fireEvent.mouseMove(screen.getByTestId('item-1'), { movementX: 10, movementY: 10 });
    await waitFor(() => {
      expect(screen.getByTestId('item-1')).toHaveFocus();
    });
    expect(screen.getByTestId('item-1')).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps keyboard modality when a stationary pointermove fires on the floating element', async () => {
    await render(<App />);

    await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
    await waitFor(() => {
      expect(screen.getByTestId('item-0')).toHaveFocus();
    });

    // The stationary sequence bubbles a `pointermove` through the floating
    // element before the item receives the `mousemove`.
    await fireEvent.pointerMove(screen.getByRole('menu'), { pointerType: 'mouse' });
    await fireEvent.mouseMove(screen.getByTestId('item-1'));
    expect(screen.getByTestId('item-0')).toHaveFocus();

    // Scrolling can also move the active item out from under the pointer. This
    // must not reset the keyboard highlight as though the pointer had left it.
    await fireEvent.pointerLeave(screen.getByTestId('item-0'), {
      pointerType: 'mouse',
      relatedTarget: screen.getByRole('menu'),
    });
    expect(screen.getByTestId('item-0')).toHaveAttribute('aria-selected', 'true');
  });
});
