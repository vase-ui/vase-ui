import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import * as Menu from '../index.parts';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  isJSDOM,
  screen,
  takeReportedMessages,
} from '#test-utils';
import {
  ContextMenuProvider,
  createContextMenuContext,
} from '../../../test/fixtures/MenuParentFixture';
import { createMenuStoreProbe } from '../../../test/fixtures/MenuStoreProbe';
import { platform } from '../../common/platform';
import { REASONS } from '../../internals/reasons';
import type { HTMLProps } from '../../internals/types';

// A module namespace is read-only. The mock gives `os` as a plain object, so a case can set the
// flag.
vi.mock('../../common/platform', async () => {
  const actual =
    await vi.importActual<typeof import('../../common/platform')>('../../common/platform');
  return { ...actual, platform: { ...actual.platform, os: { ...actual.platform.os } } };
});

function setMac(mac: boolean) {
  const actual = platform.os.mac;
  Object.defineProperty(platform.os, 'mac', { value: mac, configurable: true });
  onTestFinished(() => {
    Object.defineProperty(platform.os, 'mac', { value: actual, configurable: true });
  });
}

describe('<Menu.Item />', () => {
  const { render } = createRenderer();

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
      // The `click` of `user` calls `focus()` itself, so it can't verify browser focus.
      let focusedAtMouseUp: Element | null = null;
      let focusedAtClick: Element | null = null;
      await render(
        <Menu.Root open highlightItemOnHover={false}>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <input aria-label="Start" />
                <Menu.Item
                  closeOnClick={false}
                  nativeButton={nativeButton}
                  onMouseup={(event: MouseEvent) => {
                    focusedAtMouseUp = (event.currentTarget as Element).ownerDocument.activeElement;
                  }}
                  onClick={(event: MouseEvent) => {
                    focusedAtClick = (event.currentTarget as Element).ownerDocument.activeElement;
                  }}
                  v-slots={
                    nativeButton
                      ? {
                          render: ({ props }: { props: HTMLProps }) => (
                            <button {...props} type="button">
                              Item
                            </button>
                          ),
                        }
                      : { default: () => 'Item' }
                  }
                />
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

  it('allows onMouseDown to call preventBaseUIHandler', async () => {
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
      await flushMicrotasks();
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

    it('is disabled by a disabled root', async () => {
      await render(
        <Menu.Root open disabled>
          <Menu.Item>Item</Menu.Item>
        </Menu.Root>,
      );

      const item = screen.getByRole('menuitem');
      expect(item).toHaveAttribute('data-disabled');
      expect(item).toHaveAttribute('aria-disabled', 'true');
    });
  });

  it('does not close the menu when onClick prevents Base UI handler', async () => {
    const onClick = vi.fn((event) => event.preventVaseUIHandler());
    const { user } = await render(
      <Menu.Root>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item onClick={onClick}>Item</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    const trigger = screen.getByRole('button', { name: 'Open' });
    await user.click(trigger);

    const item = await screen.findByRole('menuitem');
    await user.click(item);

    expect(onClick.mock.calls.length).toBe(1);
    expect(screen.queryByRole('menu')).not.toBe(null);
  });

  describe('prop: closeOnClick', () => {
    it('closes the menu when the item is clicked by default', async () => {
      const { user } = await render(
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>Item</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = await screen.findByRole('menuitem');
      await user.click(item);

      expect(screen.queryByRole('menu')).toBe(null);
    });

    it('when `closeOnClick=false` does not close the menu when the item is clicked', async () => {
      const { user } = await render(
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item closeOnClick={false}>Item</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = await screen.findByRole('menuitem');
      await user.click(item);

      expect(screen.queryByRole('menu')).not.toBe(null);
    });

    it('reports the item press as the reason of the close', async () => {
      const onOpenChange = vi.fn();
      const { user } = await render(
        <Menu.Root defaultOpen onOpenChange={onOpenChange}>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item closeOnClick>Item</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      await user.click(screen.getByRole('menuitem'));

      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.itemPress);
    });
  });

  describe('keyboard activation', () => {
    it.each([
      { name: 'Enter', key: '{Enter}' },
      { name: 'Space', key: ' ' },
    ])('clicks the focused item with $name', async ({ key }) => {
      const onClick = vi.fn();
      const { user } = await render(
        <Menu.Root open>
          <Menu.Item closeOnClick={false} onClick={onClick}>
            Item
          </Menu.Item>
        </Menu.Root>,
      );

      screen.getByRole('menuitem').focus();
      await user.keyboard(key);

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not click the item with Space while a typeahead runs', async () => {
      const probe = createMenuStoreProbe();
      const onClick = vi.fn();
      const { user } = await render(
        <Menu.Root open>
          <probe.Probe />
          <Menu.Item onClick={onClick}>Item</Menu.Item>
        </Menu.Root>,
      );

      probe.store.context.typingRef.value = true;
      screen.getByRole('menuitem').focus();
      await user.keyboard(' ');

      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('highlight', () => {
    it('is highlighted and holds the tab stop while the store highlights its index', async () => {
      const probe = createMenuStoreProbe();
      await render(
        <Menu.Root open>
          <probe.Probe />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>1</Menu.Item>
                <Menu.Item>2</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const [first, second] = screen.getAllByRole('menuitem');
      expect(first).toHaveAttribute('tabindex', '-1');
      expect(second).toHaveAttribute('tabindex', '-1');

      probe.store.setActiveIndex(1, REASONS.keyboard);
      await flushMicrotasks();

      expect(first).not.toHaveAttribute('data-highlighted');
      expect(first).toHaveAttribute('tabindex', '-1');
      expect(second).toHaveAttribute('data-highlighted');
      expect(second).toHaveAttribute('tabindex', '0');
    });

    it('reports its label prop with the highlight', async () => {
      const probe = createMenuStoreProbe();
      const onItemHighlighted = vi.fn();
      await render(
        <Menu.Root open onItemHighlighted={onItemHighlighted}>
          <probe.Probe />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item label="Copy">Copy the file</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      probe.store.setActiveIndex(0, REASONS.keyboard);
      await flushMicrotasks();

      expect(onItemHighlighted.mock.lastCall?.[0]).toBe(screen.getByRole('menuitem'));
      expect(onItemHighlighted.mock.lastCall?.[1].label).toBe('Copy');
    });

    it('tells the popup tree about a mouse move over the item', async () => {
      const probe = createMenuStoreProbe();
      const onItemHover = vi.fn();
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

      const events = probe.store.select('floatingTreeRoot').events;
      events.on('itemhover', onItemHover);
      onTestFinished(() => events.off('itemhover', onItemHover));

      const item = screen.getByRole('menuitem');
      await fireEvent.mouseMove(item);

      expect(onItemHover).toHaveBeenCalledTimes(1);
      expect(onItemHover).toHaveBeenCalledWith({
        nodeId: probe.store.select('floatingNodeId'),
        target: item,
      });
    });
  });

  describe('release of a press that started on the trigger', () => {
    it.each([
      { name: 'clicks and focuses the item', allowMouseUp: true, clicks: 1 },
      { name: 'does nothing with no trigger press', allowMouseUp: false, clicks: 0 },
    ])('a mouse release $name', async (testCase) => {
      const probe = createMenuStoreProbe();
      const onClick = vi.fn();
      await render(
        <Menu.Root open>
          <probe.Probe />
          <Menu.Item closeOnClick={false} onClick={onClick}>
            Item
          </Menu.Item>
        </Menu.Root>,
      );

      probe.store.context.allowMouseUpTriggerRef.value = testCase.allowMouseUp;
      const item = screen.getByRole('menuitem');
      await fireEvent.mouseUp(item);

      expect(onClick).toHaveBeenCalledTimes(testCase.clicks);
      if (testCase.clicks === 1) {
        expect(onClick.mock.lastCall?.[0].detail).toBe(1);
        expect(item).toHaveFocus();
      } else {
        expect(item).not.toHaveFocus();
      }
    });

    it('in a context menu, ignores the release at the point where the menu opened', async () => {
      // On macOS no other rule ignores the release of the right button.
      setMac(true);
      const context = createContextMenuContext();
      const probe = createMenuStoreProbe();
      const onClick = vi.fn();
      await render(
        <ContextMenuProvider context={context}>
          <Menu.Root open>
            <probe.Probe />
            <Menu.Item closeOnClick={false} onClick={onClick}>
              Item
            </Menu.Item>
          </Menu.Root>
        </ContextMenuProvider>,
      );

      probe.store.context.allowMouseUpTriggerRef.value = true;
      context.initialCursorPointRef.value = { x: 10, y: 10 };
      await fireEvent.mouseUp(screen.getByRole('menuitem'), {
        button: 2,
        clientX: 11,
        clientY: 10,
      });

      expect(onClick).not.toHaveBeenCalled();
      expect(context.initialCursorPointRef.value).toBe(null);
    });

    // On a platform that is not macOS, the release of the right button belongs to the gesture that
    // opened the context menu.
    it.each([
      { name: 'clicks the item on macOS', mac: true, clicks: 1 },
      { name: 'does nothing on another platform', mac: false, clicks: 0 },
    ])('in a context menu, a release of the right button $name', async (testCase) => {
      setMac(testCase.mac);
      const probe = createMenuStoreProbe();
      const onClick = vi.fn();
      await render(
        <ContextMenuProvider context={createContextMenuContext()}>
          <Menu.Root open>
            <probe.Probe />
            <Menu.Item closeOnClick={false} onClick={onClick}>
              Item
            </Menu.Item>
          </Menu.Root>
        </ContextMenuProvider>,
      );

      probe.store.context.allowMouseUpTriggerRef.value = true;

      await fireEvent.mouseUp(screen.getByRole('menuitem'), { button: 2 });

      expect(onClick).toHaveBeenCalledTimes(testCase.clicks);
    });

    it('in a context menu, does nothing for a release of the left button', async () => {
      setMac(true);
      const probe = createMenuStoreProbe();
      const onClick = vi.fn();
      await render(
        <ContextMenuProvider context={createContextMenuContext()}>
          <Menu.Root open>
            <probe.Probe />
            <Menu.Item closeOnClick={false} onClick={onClick}>
              Item
            </Menu.Item>
          </Menu.Root>
        </ContextMenuProvider>,
      );

      probe.store.context.allowMouseUpTriggerRef.value = true;

      await fireEvent.mouseUp(screen.getByRole('menuitem'), { button: 0 });

      expect(onClick).not.toHaveBeenCalled();
    });
  });

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
