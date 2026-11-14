import { describe, expect, it, vi } from 'vitest';
import { defineComponent, KeepAlive, shallowRef } from 'vue';
import * as Select from '../index.parts';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  positionerConformanceTests,
  screen,
} from '#test-utils';

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
            {...positioner}
            v-slots={renderPositioner ? { render: renderPositioner } : undefined}
          >
            <Select.Popup {...popup}>Popup</Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ),
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
});
