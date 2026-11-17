import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { defineComponent, h, shallowRef } from 'vue';
import type { Component } from 'vue';
import { Select } from '@vase-ui/vue/select';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  isInaccessible,
  screen,
  waitFor,
} from '#test-utils';
import { createAttribute } from '../../utils/popups/createAttribute';
import { useSelectRootContext } from '../root/SelectRootContext';
import type { SelectStore } from '../store';

const INTERNAL_BACKDROP_SELECTOR = `[${createAttribute('inert')}]`;

type RenderSlotProps = { props: Record<string, unknown>; children: Component };

describe('<Select.Portal />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.Portal />, () => ({
    elementIsRoot: false,
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(<Select.Root open>{node}</Select.Root>);
      await flushMicrotasks();
      return result;
    },
  }));

  it('renders the popup in the children component of the #render slot', async () => {
    await render(
      <Select.Root open>
        <Select.Trigger />
        <Select.Portal
          v-slots={{
            render: ({ props, children }: RenderSlotProps) => (
              <section {...props} data-testid="portal">
                {h(children, null, () => (
                  <Select.Positioner>
                    <Select.Popup>
                      <Select.Item value="a">a</Select.Item>
                    </Select.Popup>
                  </Select.Positioner>
                ))}
              </section>
            ),
          }}
        />
      </Select.Root>,
    );
    await flushMicrotasks();

    const portal = screen.getByTestId('portal');
    expect(portal.localName).toBe('section');
    expect(portal.parentElement).toBe(document.body);
    expect(portal.contains(screen.getByRole('option', { name: 'a' }))).toBe(true);
  });

  describe('internal backdrop', () => {
    function getBackdrop() {
      return screen.getByTestId('portal').querySelector<HTMLElement>(INTERNAL_BACKDROP_SELECTOR);
    }

    it('renders it before the positioner in the element of the #render slot', async () => {
      await render(
        <Select.Root open>
          <Select.Trigger />
          <Select.Portal
            v-slots={{
              render: ({ props, children }: RenderSlotProps) => (
                <section {...props} data-testid="portal">
                  {h(children, null, () => (
                    <Select.Positioner data-testid="positioner">
                      <Select.Popup />
                    </Select.Positioner>
                  ))}
                </section>
              ),
            }}
          />
        </Select.Root>,
      );
      await flushMicrotasks();

      const backdrop = getBackdrop();
      expect(backdrop).not.toBe(null);
      expect(screen.getByTestId('positioner').previousElementSibling).toBe(backdrop);
    });

    it('cuts the trigger out of the backdrop', async () => {
      await render(
        <Select.Root open>
          <Select.Trigger
            style={{ position: 'fixed', left: '10px', top: '20px', width: '30px', height: '40px' }}
          />
          <Select.Portal data-testid="portal">
            <Select.Positioner alignItemWithTrigger={false}>
              <Select.Popup />
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );
      await flushMicrotasks();

      const clipPath = getBackdrop()!.style.clipPath;
      expect(clipPath).toContain('10px 20px');
      expect(clipPath).toContain('40px 60px');
    });

    it('is inert while the select closes, and leaves when the select unmounts', async () => {
      let root!: Select.Root.Actions;
      await render(() => (
        <Select.Root
          ref={(instance: unknown) => {
            if (instance) {
              root = instance as Select.Root.Actions;
            }
          }}
          defaultOpen
          onOpenChange={(_open: boolean, details: Select.Root.OpenChangeEventDetails) =>
            details.preventUnmountOnClose()
          }
        >
          <Select.Trigger />
          <Select.Portal data-testid="portal">
            <Select.Positioner>
              <Select.Popup />
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));
      await flushMicrotasks();
      const backdrop = getBackdrop()!;
      expect(backdrop.inert).toBe(false);

      root.close();
      await flushMicrotasks();
      expect(backdrop.inert).toBe(true);

      root.unmount();
      await flushMicrotasks();
      expect(backdrop.isConnected).toBe(false);
    });

    it('renders no backdrop while only the items of a closed select are mounted', async () => {
      let store!: SelectStore;
      const StoreProbe = defineComponent(() => {
        store = useSelectRootContext();
        return () => null;
      });
      await render(
        <Select.Root>
          <StoreProbe />
          <Select.Trigger />
          <Select.Portal data-testid="portal">
            <Select.Positioner data-testid="positioner">
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      store.set('forceMounted', true);
      await flushMicrotasks();

      expect(screen.getByTestId('positioner').isConnected).toBe(true);
      expect(getBackdrop()).toBe(null);
    });
  });

  describe('VUE-95: the popup of a closed select', () => {
    it.each([
      { name: 'a close that returns the focus', close: 'escape' },
      { name: 'a close that moves the focus out', close: 'outside' },
      { name: 'a close by the open prop', close: 'prop' },
    ] as const)('keeps the popup element and its items after $name', async ({ close }) => {
      const open = shallowRef(true);
      const handleOpenChangeComplete = vi.fn();
      const { user } = await render(() => (
        <div>
          <button type="button">Outside</button>
          <Select.Root
            {...(close === 'prop' ? { open: open.value } : { defaultOpen: true })}
            onOpenChangeComplete={handleOpenChangeComplete}
          >
            <Select.Trigger />
            <Select.Portal>
              <Select.Positioner alignItemWithTrigger={false}>
                <Select.Popup data-testid="popup">
                  <Select.Item value="a">a</Select.Item>
                  <Select.Item value="b">b</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </div>
      ));
      const popup = await screen.findByTestId('popup');
      const items = screen.getAllByRole('option');
      const removals: Node[] = [];
      const observer = new MutationObserver((records) => {
        for (const record of records) {
          removals.push(...[...record.removedNodes].filter((node) => node.contains(popup)));
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      onTestFinished(() => observer.disconnect());

      if (close === 'escape') {
        await user.keyboard('{Escape}');
      } else if (close === 'outside') {
        await user.click(screen.getByRole('button', { name: 'Outside' }));
      } else {
        open.value = false;
      }
      await waitFor(() => {
        expect(handleOpenChangeComplete).toHaveBeenLastCalledWith(false);
      });
      await flushMicrotasks();

      expect(removals).toEqual([]);
      expect(screen.getByTestId('popup')).toBe(popup);
      expect(isInaccessible(popup)).toBe(true);
      const itemsAfter = screen.getAllByRole('option', { hidden: true });
      expect(itemsAfter).toHaveLength(items.length);
      itemsAfter.forEach((item, index) => {
        expect(item).toBe(items[index]);
      });
    });
  });
});
