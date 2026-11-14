import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { Menu } from '@vase-ui/vue/menu';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  isJSDOM,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';
import { createMenuStoreProbe } from '../../../test/fixtures/MenuStoreProbe';
import { REASONS } from '../../internals/reasons';

describe('<Menu.Item />', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describeConformance(<Menu.Item />, () => ({
    refInstanceof: window.HTMLDivElement,
    button: true,
    render: (node) => {
      return render(<Menu.Root open>{node}</Menu.Root>);
    },
  }));

  it('calls the onClick handler when clicked', async () => {
    const onClick = vi.fn();
    const { user } = await render(
      <Menu.Root open>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item onClick={onClick} id="item">
                Item
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    const item = screen.getByRole('menuitem');
    await user.click(item);

    expect(onClick.mock.calls.length).toBe(1);
  });

  it.skipIf(isJSDOM).each([
    { name: 'default', nativeButton: false },
    { name: 'native button', nativeButton: true },
  ])(
    'native press focuses a $name item before mouseup and click without hover focus',
    async ({ nativeButton }) => {
      onTestFinished(() => userEvent.unhover(document.body));
      let focusedAtMouseUp: Element | null = null;
      let focusedAtClick: Element | null = null;
      const handlers = {
        onMouseup(event: MouseEvent) {
          focusedAtMouseUp = (event.currentTarget as Element).ownerDocument.activeElement;
        },
        onClick(event: MouseEvent) {
          focusedAtClick = (event.currentTarget as Element).ownerDocument.activeElement;
        },
      };
      await render(
        <Menu.Root open highlightItemOnHover={false}>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <input aria-label="Start" />
                {nativeButton ? (
                  <Menu.Item
                    closeOnClick={false}
                    nativeButton
                    {...handlers}
                    v-slots={{
                      render: ({ props }: { props: Record<string, unknown> }) => (
                        <button type="button" {...props}>
                          Item
                        </button>
                      ),
                    }}
                  />
                ) : (
                  <Menu.Item closeOnClick={false} {...handlers}>
                    Item
                  </Menu.Item>
                )}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const input = screen.getByRole('textbox', { name: 'Start' });
      const item = screen.getByRole('menuitem', { name: 'Item' });
      await userEvent.click(input);
      expect(input).toHaveFocus();

      await userEvent.click(item);

      expect(focusedAtMouseUp).toBe(item);
      expect(focusedAtClick).toBe(item);
    },
  );

  it('allows onMouseDown to call preventVaseUIHandler', async () => {
    await render(
      <Menu.Root open>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item onMousedown={(event) => event.preventVaseUIHandler()}>Item</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    const item = screen.getByRole('menuitem');

    await fireEvent.mouseDown(item);
  });

  describe('disabled state', () => {
    it('can be focused but not interacted with when disabled', async () => {
      const handleClick = vi.fn();
      const handleKeyDown = vi.fn();
      const handleKeyUp = vi.fn();

      await render(
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item
                  disabled
                  onClick={handleClick}
                  onKeydown={handleKeyDown}
                  onKeyup={handleKeyUp}
                >
                  Item
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const item = screen.getByRole('menuitem');
      item.focus();
      expect(item).toHaveFocus();

      await fireEvent.keyDown(item, { key: 'Enter' });
      expect(handleKeyDown.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);

      await fireEvent.keyUp(item, { key: 'Space' });
      expect(handleKeyUp.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);

      await fireEvent.click(item);
      expect(handleKeyDown.mock.calls.length).toBe(0);
      expect(handleKeyUp.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);
    });
  });

  describe('prop: closeOnClick', () => {
    it.each([
      { name: 'closes the menu', closeOnClick: undefined, open: false },
      { name: 'keeps the menu open', closeOnClick: false, open: true },
    ])('$name when the item is clicked', async ({ closeOnClick, open }) => {
      const onOpenChange = vi.fn();
      const { user } = await render(
        <Menu.Root defaultOpen onOpenChange={onOpenChange}>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item closeOnClick={closeOnClick}>Item</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      await user.click(screen.getByRole('menuitem'));

      if (open) {
        expect(onOpenChange).not.toHaveBeenCalled();
        expect(screen.queryByRole('menu')).not.toBe(null);
      } else {
        await waitFor(() => {
          expect(screen.queryByRole('menu')).toBe(null);
        });
        expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
        expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.itemPress);
      }
    });

    it('keeps the menu open when onClick prevents the handler of the item', async () => {
      const onClick = vi.fn((event) => event.preventVaseUIHandler());
      const { user } = await render(
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item onClick={onClick}>Item</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      await user.click(screen.getByRole('menuitem'));

      expect(onClick).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('menu')).not.toBe(null);
    });
  });

  describe('highlight', () => {
    function renderItems(props: Record<string, unknown> = {}) {
      const probe = createMenuStoreProbe();
      const result = render(
        <Menu.Root open {...props}>
          <probe.Probe />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>One</Menu.Item>
                <Menu.Item label="Custom label">Two</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );
      return { probe, result };
    }

    it('has the menuitem role, and the tab stop and the highlighted state of the active index', async () => {
      const { probe, result } = renderItems();
      await result;
      const [one, two] = screen.getAllByRole('menuitem');
      expect(one).toHaveAttribute('tabindex', '-1');
      expect(two).toHaveAttribute('tabindex', '-1');
      expect(one).not.toHaveAttribute('data-highlighted');

      probe.store.setActiveIndex(1, REASONS.keyboard);
      await flushMicrotasks();

      expect(one).toHaveAttribute('tabindex', '-1');
      expect(two).toHaveAttribute('tabindex', '0');
      expect(two).toHaveAttribute('data-highlighted');
      expect(one).not.toHaveAttribute('data-highlighted');
    });

    it('gives the label prop to itemHighlighted', async () => {
      const onItemHighlighted = vi.fn();
      const { probe, result } = renderItems({ onItemHighlighted });
      await result;

      probe.store.setActiveIndex(1, REASONS.keyboard);
      await waitFor(() => {
        expect(onItemHighlighted).toHaveBeenCalledTimes(1);
      });

      expect(onItemHighlighted.mock.lastCall?.[0]).toBe(screen.getAllByRole('menuitem')[1]);
      expect(onItemHighlighted.mock.lastCall?.[1].label).toBe('Custom label');
    });

    it('uses its text as the label when it has no label prop', async () => {
      const onItemHighlighted = vi.fn();
      const { probe, result } = renderItems({ onItemHighlighted });
      await result;

      probe.store.setActiveIndex(0, REASONS.keyboard);
      await waitFor(() => {
        expect(onItemHighlighted).toHaveBeenCalledTimes(1);
      });

      expect(onItemHighlighted.mock.lastCall?.[1].label).toBe('One');
    });
  });

  describe('events of the popup tree', () => {
    it('tells the tree that the pointer moved over the item', async () => {
      const probe = createMenuStoreProbe();
      await render(
        <Menu.Root open>
          <probe.Probe />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>Item</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );
      const listener = vi.fn();
      probe.store.select('floatingTreeRoot').events.on('itemhover', listener);
      const item = screen.getByRole('menuitem');

      await fireEvent.mouseMove(item);

      expect(listener).toHaveBeenCalledWith({
        nodeId: probe.store.select('floatingNodeId'),
        target: item,
      });
    });
  });

  describe('drag release', () => {
    it.each([
      { name: 'clicks', armed: true, clicks: 1, open: false },
      { name: 'does not click', armed: false, clicks: 0, open: true },
    ])('$name the item when the mouse is released over it', async ({ armed, clicks, open }) => {
      const onClick = vi.fn();
      const probe = createMenuStoreProbe();
      await render(
        <Menu.Root defaultOpen>
          <probe.Probe />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item onClick={onClick}>Item</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );
      probe.store.context.allowMouseUpTriggerRef.value = armed;

      await fireEvent.mouseUp(screen.getByRole('menuitem'));

      expect(onClick).toHaveBeenCalledTimes(clicks);
      if (clicks > 0) {
        expect(onClick.mock.lastCall?.[0].detail).toBe(1);
        expect(onClick.mock.lastCall?.[0].pointerType).toBe('mouse');
      }
      if (open) {
        expect(screen.queryByRole('menu')).not.toBe(null);
      } else {
        await waitFor(() => {
          expect(screen.queryByRole('menu')).toBe(null);
        });
      }
    });
  });

  describe('typeahead', () => {
    it('keeps the Space key from activating the item while a typeahead session runs', async () => {
      const probe = createMenuStoreProbe();
      await render(
        <Menu.Root open>
          <probe.Probe />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>Item</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );
      const item = screen.getByRole('menuitem');
      item.focus();

      probe.store.context.typingRef.value = true;
      const prevented = !(await fireEvent.keyDown(item, { key: ' ' }));

      expect(prevented).toBe(true);
    });
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case of the file then gets a warning about a slot.
  it('throws when rendered outside Menu.Root', async () => {
    await expect(render(<Menu.Item />)).rejects.toThrow(
      'Vase UI: A part of Menu must be inside <Menu.Root>. Without a root the part has no menu state. Put the part inside <Menu.Root>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
