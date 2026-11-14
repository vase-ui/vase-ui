import { describe, expect, it, vi } from 'vitest';
import { computed, defineComponent, provide } from 'vue';
import * as Menu from '../index.parts';
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
import { REASONS } from '../../internals/reasons';
import type { HTMLProps } from '../../internals/types';
import { MenuRadioGroupContext } from '../radio-group/MenuRadioGroupContext';

const testRadioGroupContext: MenuRadioGroupContext = {
  value: computed(() => '0'),
  setValue: () => {},
  disabled: computed(() => false),
};

const TestRadioGroupProvider = defineComponent((_, { slots }) => {
  provide(MenuRadioGroupContext, testRadioGroupContext);
  return () => slots.default?.();
});

describe('<Menu.RadioItem />', () => {
  const { render } = createRenderer();

  describeConformance(<Menu.RadioItem value="0" />, () => ({
    render: (node) => {
      return render(
        <Menu.Root open>
          <TestRadioGroupProvider>{node}</TestRadioGroupProvider>
        </Menu.Root>,
      );
    },
    refInstanceof: window.HTMLDivElement,
  }));

  it('perf: does not rerender menu items unnecessarily', async ({ skip }) => {
    if (isJSDOM) {
      skip();
    }

    const renderItem1Spy = vi.fn();
    const renderItem2Spy = vi.fn();
    const renderItem3Spy = vi.fn();
    const renderItem4Spy = vi.fn();

    // The slot runs in each render of the item.
    function loggingRoot(renderSpy: () => void, label: string) {
      return {
        render: ({ props }: { props: HTMLProps }) => {
          renderSpy();
          return <li {...props}>{label}</li>;
        },
      };
    }

    await render(
      <Menu.Root open>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.RadioGroup>
                <Menu.RadioItem value={1} v-slots={loggingRoot(renderItem1Spy, '1')} id="item-1" />
                <Menu.RadioItem value={2} v-slots={loggingRoot(renderItem2Spy, '2')} id="item-2" />
                <Menu.RadioItem value={3} v-slots={loggingRoot(renderItem3Spy, '3')} id="item-3" />
                <Menu.RadioItem value={4} v-slots={loggingRoot(renderItem4Spy, '4')} id="item-4" />
              </Menu.RadioGroup>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    const menuItems = screen.getAllByRole('menuitemradio');
    menuItems[0].focus();
    await flushMicrotasks();

    renderItem1Spy.mockClear();
    renderItem2Spy.mockClear();
    renderItem3Spy.mockClear();
    renderItem4Spy.mockClear();

    expect(renderItem1Spy.mock.calls.length).toBe(0);

    await fireEvent.keyDown(menuItems[0], { key: 'ArrowDown' }); // highlights '2'

    await waitFor(
      () => {
        expect(renderItem1Spy.mock.calls.length).toBe(1); // '1' rerenders as it loses highlight
      },
      { timeout: 1000 },
    );

    await waitFor(
      () => {
        expect(renderItem2Spy.mock.calls.length).toBe(1); // '2' rerenders as it receives highlight
      },
      { timeout: 1000 },
    );

    // neither the highlighted nor the selected state of these options changed,
    // so they don't need to rerender:
    expect(renderItem3Spy.mock.calls.length).toBe(0);
    expect(renderItem4Spy.mock.calls.length).toBe(0);
  });

  describe('state management', () => {
    it.each([{ key: 'Space' }, { key: 'Enter' }])(
      'selects the item when $key is pressed',
      async ({ key }) => {
        const { user } = await render(
          <Menu.Root>
            <Menu.Trigger>Open</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.RadioGroup defaultValue={0}>
                  <Menu.RadioItem value={1}>Item</Menu.RadioItem>
                </Menu.RadioGroup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>,
        );

        const trigger = screen.getByRole('button', { name: 'Open' });
        trigger.focus();
        await flushMicrotasks();
        await user.keyboard('[ArrowDown]');
        const item = screen.getByRole('menuitemradio');

        await waitFor(() => {
          expect(item).toHaveFocus();
        });

        await user.keyboard(`[${key}]`);
        expect(item).toHaveAttribute('data-checked', '');
      },
    );

    it.skipIf(isJSDOM)(
      'does not select when Space is pressed during an active typeahead session',
      async () => {
        const onValueChange = vi.fn();
        const { user } = await render(
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.RadioGroup defaultValue={0} onValueChange={onValueChange}>
                    <Menu.RadioItem value={1}>Item One</Menu.RadioItem>
                    <Menu.RadioItem value={2}>Item Two</Menu.RadioItem>
                  </Menu.RadioGroup>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>,
        );

        const [itemOne, itemTwo] = screen.getAllByRole('menuitemradio');

        itemOne.focus();
        await flushMicrotasks();

        await user.keyboard('Item T');

        await waitFor(() => {
          expect(itemTwo).toHaveFocus();
        });

        await user.keyboard('[Space]');
        await user.keyboard('[Space]');

        expect(onValueChange.mock.calls.length > 0).toBe(false);
        expect(itemTwo).toHaveAttribute('aria-checked', 'false');
      },
    );
  });

  describe('state', () => {
    it('has the role, the state and the ARIA attributes of a selected item', async () => {
      await render(
        <Menu.Root open>
          <Menu.RadioGroup defaultValue="a">
            <Menu.RadioItem value="a">A</Menu.RadioItem>
            <Menu.RadioItem value="b">B</Menu.RadioItem>
          </Menu.RadioGroup>
        </Menu.Root>,
      );

      const [a, b] = screen.getAllByRole('menuitemradio');
      expect(a).toHaveAttribute('aria-checked', 'true');
      expect(a).toHaveAttribute('data-checked', '');
      expect(b).toHaveAttribute('aria-checked', 'false');
      expect(b).toHaveAttribute('data-unchecked', '');
    });

    it('is disabled by a disabled root', async () => {
      await render(
        <Menu.Root open disabled>
          <Menu.RadioGroup>
            <Menu.RadioItem value="a">A</Menu.RadioItem>
          </Menu.RadioGroup>
        </Menu.Root>,
      );

      const item = screen.getByRole('menuitemradio');
      expect(item).toHaveAttribute('data-disabled');
      expect(item).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('prop: closeOnClick', () => {
    it.each([
      { name: 'by default', closeOnClick: undefined, closes: false },
      { name: 'with closeOnClick', closeOnClick: true, closes: true },
    ])('closes the menu for a click $name only when it must', async (testCase) => {
      const onOpenChange = vi.fn();
      const { user } = await render(
        <Menu.Root defaultOpen onOpenChange={onOpenChange}>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.RadioGroup>
                  <Menu.RadioItem value="a" closeOnClick={testCase.closeOnClick}>
                    A
                  </Menu.RadioItem>
                </Menu.RadioGroup>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      await user.click(screen.getByRole('menuitemradio'));

      if (testCase.closes) {
        expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.itemPress);
        expect(screen.queryByRole('menu')).toBe(null);
      } else {
        expect(onOpenChange).not.toHaveBeenCalled();
        expect(screen.queryByRole('menu')).not.toBe(null);
      }
    });
  });

  describe('prop: focusableWhenDisabled', () => {
    it('can be focused but not interacted with when a radio group is disabled', async () => {
      const handleClick = vi.fn();
      const handleKeyDown = vi.fn();
      const handleKeyUp = vi.fn();
      const handleValueChange = vi.fn();

      await render(
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.RadioGroup defaultValue={0} disabled onValueChange={handleValueChange}>
                  <Menu.RadioItem
                    value="one"
                    onClick={handleClick}
                    onKeydown={handleKeyDown}
                    onKeyup={handleKeyUp}
                  >
                    one
                  </Menu.RadioItem>
                  <Menu.RadioItem
                    value="two"
                    onClick={handleClick}
                    onKeydown={handleKeyDown}
                    onKeyup={handleKeyUp}
                  >
                    two
                  </Menu.RadioItem>
                </Menu.RadioGroup>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const [item1, item2] = screen.getAllByRole('menuitemradio');

      expect(item1).toHaveAttribute('data-disabled');
      expect(item2).toHaveAttribute('data-disabled');

      item1.focus();
      await flushMicrotasks();
      expect(item1).toHaveFocus();

      await fireEvent.keyDown(item1, { key: 'Enter' });
      expect(handleKeyDown.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);
      expect(handleValueChange.mock.calls.length).toBe(0);

      await fireEvent.keyUp(item1, { key: 'Space' });
      expect(handleKeyDown.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);
      expect(handleValueChange.mock.calls.length).toBe(0);

      await fireEvent.click(item1);
      expect(handleClick.mock.calls.length).toBe(0);
      expect(handleValueChange.mock.calls.length).toBe(0);

      await fireEvent.keyDown(item1, { key: 'ArrowDown' });
      expect(handleKeyDown.mock.calls.length).toBe(0);
      expect(item2).toHaveFocus();

      await fireEvent.keyDown(item2, { key: 'Enter' });
      expect(handleKeyDown.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);
      expect(handleValueChange.mock.calls.length).toBe(0);

      await fireEvent.keyUp(item2, { key: 'Space' });
      expect(handleKeyDown.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);
      expect(handleValueChange.mock.calls.length).toBe(0);

      await fireEvent.click(item2);
      expect(handleClick.mock.calls.length).toBe(0);
      expect(handleValueChange.mock.calls.length).toBe(0);
    });
  });

  it('can be focused but not interacted with when individual items are disabled', async () => {
    const handleClick = vi.fn();
    const handleKeyDown = vi.fn();
    const handleKeyUp = vi.fn();
    const handleValueChange = vi.fn();

    await render(
      <Menu.Root open>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.RadioGroup defaultValue={0} onValueChange={handleValueChange}>
                <Menu.RadioItem
                  value="one"
                  onClick={handleClick}
                  onKeydown={handleKeyDown}
                  onKeyup={handleKeyUp}
                  disabled
                >
                  one
                </Menu.RadioItem>
                <Menu.RadioItem
                  value="two"
                  onClick={handleClick}
                  onKeydown={handleKeyDown}
                  onKeyup={handleKeyUp}
                >
                  two
                </Menu.RadioItem>
              </Menu.RadioGroup>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    const [item1, item2] = screen.getAllByRole('menuitemradio');

    expect(item1).toHaveAttribute('data-disabled');
    expect(item2).not.toHaveAttribute('data-disabled');

    item1.focus();
    await flushMicrotasks();
    expect(item1).toHaveFocus();

    await fireEvent.keyDown(item1, { key: 'Enter' });
    expect(handleKeyDown.mock.calls.length).toBe(0);
    expect(handleClick.mock.calls.length).toBe(0);
    expect(handleValueChange.mock.calls.length).toBe(0);

    await fireEvent.keyUp(item1, { key: 'Space' });
    expect(handleKeyDown.mock.calls.length).toBe(0);
    expect(handleClick.mock.calls.length).toBe(0);
    expect(handleValueChange.mock.calls.length).toBe(0);

    await fireEvent.click(item1);
    expect(handleClick.mock.calls.length).toBe(0);
    expect(handleValueChange.mock.calls.length).toBe(0);

    await fireEvent.keyDown(item1, { key: 'ArrowDown' });
    expect(handleKeyDown.mock.calls.length).toBe(0);
    expect(item2).toHaveFocus();

    await fireEvent.keyDown(item2, { key: 'Enter' });
    expect(handleKeyDown.mock.calls.length).toBe(1);
    expect(handleClick.mock.calls.length).toBe(1);
    expect(handleValueChange.mock.calls.length).toBe(1);
    expect(handleValueChange.mock.calls[0][0]).toBe('two');

    await fireEvent.keyDown(item2, { key: 'ArrowDown' });
    await waitFor(() => {
      expect(item1).toHaveFocus();
    });
  });

  it('throws when rendered outside Menu.RadioGroup', async () => {
    await expect(
      render(
        <Menu.Root open>
          <Menu.RadioItem value="one" />
        </Menu.Root>,
      ),
    ).rejects.toThrow(
      'Vase UI: <Menu.RadioItem> must be inside <Menu.RadioGroup>. Without a group the item has no value to select. Put the item inside <Menu.RadioGroup>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
