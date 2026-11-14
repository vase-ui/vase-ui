import { describe, expect, it, vi } from 'vitest';
import { defineComponent, KeepAlive, nextTick, shallowRef } from 'vue';
import * as Select from '../index.parts';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  isJSDOM,
  positionerConformanceTests,
  screen,
  waitFor,
} from '#test-utils';
import { getScrollLockRegistry, isScrollLocked } from '../../../test/fixtures/scrollDocument';
import SelectPositionerScoped from './SelectPositionerScoped.test.vue';

describe('<Select.Positioner />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.Positioner />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(
        <Select.Root open>
          <Select.Portal>{node}</Select.Portal>
        </Select.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));

  const triggerStyle = { width: '72px', height: '36px' };
  const popupStyle = { width: '52px', height: '24px' };

  positionerConformanceTests({
    render,
    stableState: false,
    createComponent: ({
      root,
      trigger,
      positioner: { render: renderPositioner, ...positioner },
      popup,
    }) => (
      <Select.Root {...root}>
        <Select.Trigger {...trigger}>Trigger</Select.Trigger>
        <Select.Portal>
          <Select.Positioner
            align="center"
            alignItemWithTrigger={false}
            {...positioner}
            v-slots={renderPositioner ? { render: renderPositioner } : undefined}
          >
            <Select.Popup {...popup}>Popup</Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ),
  });

  describe.skipIf(isJSDOM)('kept-mounted positioner', () => {
    it('does not retain stale coordinates while closed', async () => {
      const { user } = await render(
        <Select.Root defaultOpen>
          <Select.Trigger style={triggerStyle}>Trigger</Select.Trigger>
          <Select.Portal>
            <Select.Positioner data-testid="positioner" alignItemWithTrigger={false}>
              <Select.Popup style={popupStyle}>Popup</Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );
      await flushMicrotasks();

      const positioner = screen.getByTestId('positioner');
      expect(positioner.style.transform).not.toBe('');

      await user.keyboard('{Escape}');

      // The portal can remount around the close, so re-query the kept-mounted node.
      await waitFor(() => {
        expect(screen.getByTestId('positioner').hidden).toBe(true);
      });

      // Rendering the full-size popup at coordinates computed for the hidden (zero-size)
      // positioner can overflow the layout viewport on the next open, making mobile Chrome
      // zoom the page out. The positioner must sit at the viewport origin until positioned.
      const closedPositioner = screen.getByTestId('positioner');
      await waitFor(() => {
        expect(closedPositioner.style.position).toBe('fixed');
      });
      expect(closedPositioner.style.transform).toBe('');
      expect(closedPositioner.style.top).toBe('0px');
      expect(closedPositioner.style.left).toBe('0px');
    });
  });

  it('places the selected item over the trigger again after an open that fell back to the anchored placement', async () => {
    const paddingTop = shallowRef('0px');
    // With no portal, the same positioner stays mounted from one open to the next.
    const { user } = await render(() => (
      <div style={{ paddingTop: paddingTop.value, minHeight: '600px' }}>
        <Select.Root defaultValue="a">
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Positioner data-testid="positioner">
            <Select.Popup>
              <Select.Item value="a">a</Select.Item>
              <Select.Item value="b">b</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Root>
      </div>
    ));
    const trigger = screen.getByTestId('trigger');
    const positioner = screen.getByTestId('positioner');
    const readPlacement = () => [positioner.hasAttribute('data-open'), positioner.dataset.side];

    // A trigger at the top of the viewport has no room for the placement over it.
    await user.click(trigger);
    await waitFor(() => {
      expect(readPlacement()).toEqual([true, 'bottom']);
    });

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(positioner).toHaveAttribute('hidden');
    });

    paddingTop.value = '200px';
    await flushMicrotasks();
    await user.click(trigger);

    await waitFor(() => {
      expect(readPlacement()).toEqual([true, 'none']);
    });
  });

  describe('items that change', () => {
    function renderItems(options: {
      items: { value: string[] };
      value?: { value: unknown };
      defaultValue?: unknown;
      multiple?: boolean;
      onValueChange: (value: unknown, details: Select.Root.ChangeEventDetails) => void;
    }) {
      return render(() => (
        <Select.Root
          open
          multiple={options.multiple}
          value={options.value?.value}
          defaultValue={options.defaultValue}
          onValueChange={(value: unknown, details: Select.Root.ChangeEventDetails) => {
            options.onValueChange(value, details);
            if (options.value) {
              options.value.value = value;
            }
          }}
        >
          <Select.Trigger />
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                {options.items.value.map((item) => (
                  <Select.Item key={item} value={item}>
                    {item}
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));
    }

    it('keeps a controlled value when the items and the value change in one update', async () => {
      const items = shallowRef(['a', 'b', 'c']);
      const value = shallowRef<unknown>('b');
      const handleValueChange = vi.fn();
      await renderItems({ items, value, onValueChange: handleValueChange });
      await flushMicrotasks();

      items.value = ['x', 'y', 'z'];
      value.value = 'y';
      await flushMicrotasks();

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(screen.getByRole('option', { name: 'y' })).toHaveAttribute('aria-selected', 'true');
    });

    it('clears the value when the selected item leaves the list', async () => {
      const items = shallowRef(['a', 'b', 'c']);
      const value = shallowRef<unknown>('b');
      const handleValueChange = vi.fn();
      await renderItems({ items, value, onValueChange: handleValueChange });
      await flushMicrotasks();

      items.value = ['a', 'c'];
      await flushMicrotasks();

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(handleValueChange.mock.lastCall?.[0]).toBe(null);
      expect(handleValueChange.mock.lastCall?.[1].reason).toBe('none');
    });

    it('goes back to the initial value when the selected item leaves the list', async () => {
      const items = shallowRef(['a', 'b', 'c']);
      const handleValueChange = vi.fn();
      const { user } = await renderItems({
        items,
        defaultValue: 'a',
        onValueChange: handleValueChange,
      });
      await flushMicrotasks();

      await user.click(screen.getByRole('option', { name: 'b' }));
      expect(handleValueChange.mock.lastCall?.[0]).toBe('b');

      items.value = ['a', 'c'];
      await flushMicrotasks();

      expect(handleValueChange.mock.lastCall?.[0]).toBe('a');
      expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('aria-selected', 'true');
    });

    it('removes the values of the items that leave a multiple select', async () => {
      const items = shallowRef(['a', 'b', 'c']);
      const handleValueChange = vi.fn();
      await renderItems({
        items,
        defaultValue: ['a', 'b'],
        multiple: true,
        onValueChange: handleValueChange,
      });
      await flushMicrotasks();

      items.value = ['a', 'c'];
      await flushMicrotasks();

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(handleValueChange.mock.lastCall?.[0]).toEqual(['a']);
    });

    it('clears the value when each item leaves the list', async () => {
      const items = shallowRef(['a', 'b', 'c']);
      const value = shallowRef<unknown>('b');
      const handleValueChange = vi.fn();
      await renderItems({ items, value, onValueChange: handleValueChange });
      await flushMicrotasks();

      items.value = [];
      await flushMicrotasks();

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(handleValueChange.mock.lastCall?.[0]).toBe(null);
      expect(handleValueChange.mock.lastCall?.[1].reason).toBe('none');
    });

    it('keeps the value when the items change while KeepAlive holds the select', async () => {
      const items = shallowRef(['a', 'b', 'c']);
      const handleValueChange = vi.fn();
      const Page = defineComponent({
        name: 'Page',
        setup() {
          return () => (
            <Select.Root open defaultValue="b" onValueChange={handleValueChange}>
              <Select.Trigger />
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    {items.value.map((item) => (
                      <Select.Item key={item} value={item}>
                        {item}
                      </Select.Item>
                    ))}
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          );
        },
      });
      const visible = shallowRef(true);
      await render(() => (
        <KeepAlive>{visible.value ? <Page key="page" /> : <p key="other">other</p>}</KeepAlive>
      ));
      await flushMicrotasks();

      visible.value = false;
      await flushMicrotasks();
      items.value = ['a', 'b', 'c', 'd'];
      await flushMicrotasks();
      visible.value = true;
      await flushMicrotasks();

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(screen.getByRole('option', { name: 'd' })).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('scroll lock', () => {
    function lockCount() {
      return getScrollLockRegistry()?.lockCount ?? 0;
    }

    it('locks the page while a modal select is open, and unlocks it when the select closes', async () => {
      const { user } = await render(
        <Select.Root>
          <Select.Trigger data-testid="trigger">Open</Select.Trigger>
          <Select.Portal>
            <Select.Positioner alignItemWithTrigger={false}>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      await user.click(screen.getByTestId('trigger'));
      await waitFor(() => {
        expect(isScrollLocked()).toBe(true);
      });

      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(isScrollLocked()).toBe(false);
      });
      expect(lockCount()).toBe(0);
    });

    // The trigger has room for the placement over it, as in the case above that places the
    // selected item over the trigger again.
    it.each([
      { name: 'over the trigger', alignItemWithTrigger: true, side: 'none', locks: 1 },
      { name: 'beside the trigger', alignItemWithTrigger: false, side: 'bottom', locks: 0 },
    ])(
      'locks the page for a select that is not modal only while its popup is $name',
      async ({ alignItemWithTrigger, side, locks }) => {
        const { user } = await render(
          <div style={{ paddingTop: '200px', minHeight: '600px' }}>
            <Select.Root modal={false} defaultValue="a">
              <Select.Trigger data-testid="trigger">
                <Select.Value />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner
                  data-testid="positioner"
                  alignItemWithTrigger={alignItemWithTrigger}
                >
                  <Select.Popup>
                    <Select.Item value="a">a</Select.Item>
                    <Select.Item value="b">b</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>,
        );

        await user.click(screen.getByTestId('trigger'));
        await waitFor(() => {
          expect(screen.getByTestId('positioner')).toHaveAttribute('data-side', side);
        });

        expect(lockCount()).toBe(locks);
      },
    );

    it('VUE-5: releases the lock while KeepAlive holds the select, and takes it back after', async () => {
      const show = shallowRef(true);
      const ModalSelect = defineComponent({
        name: 'ModalSelect',
        setup: () => () => (
          <Select.Root defaultOpen>
            <Select.Trigger>Open</Select.Trigger>
            <Select.Portal>
              <Select.Positioner alignItemWithTrigger={false}>
                <Select.Popup>
                  <Select.Item value="a">a</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        ),
      });
      const Other = defineComponent({ name: 'Other', setup: () => () => <p>other</p> });
      await render(() => (
        <KeepAlive>{show.value ? <ModalSelect key="select" /> : <Other key="other" />}</KeepAlive>
      ));
      await waitFor(() => {
        expect(lockCount()).toBe(1);
      });

      show.value = false;
      await flushMicrotasks();

      expect(lockCount()).toBe(0);

      show.value = true;
      await waitFor(() => {
        expect(lockCount()).toBe(1);
      });
    });
  });

  describe('VUE-61: the positioner of a modal select has one root node', () => {
    it('gives the scope id, v-show and a custom directive of the consumer to the positioner', async () => {
      const shown = shallowRef(true);
      await render(() => <SelectPositionerScoped shown={shown.value} />);
      await flushMicrotasks();
      const positioner = screen.getByTestId('positioner');

      expect(positioner.previousElementSibling).toHaveAttribute('role', 'presentation');
      expect(getComputedStyle(positioner).outlineStyle).toBe('dashed');
      expect(positioner).toHaveAttribute('data-mark', 'marked');
      expect(positioner.style.display).not.toBe('none');

      shown.value = false;
      await nextTick();

      expect(positioner.style.display).toBe('none');
    });
  });
});
