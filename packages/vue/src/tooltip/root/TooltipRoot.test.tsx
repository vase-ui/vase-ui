import { describe, expect, it, vi } from 'vitest';
import { computed, defineComponent, shallowRef } from 'vue';
import * as Tooltip from '../index.parts';
import {
  createRenderer,
  flushMicrotasks,
  hydrate,
  isInaccessible,
  popupConformanceTests,
  renderOnServer,
  screen,
  waitFor,
} from '#test-utils';
import { REASONS } from '../../internals/reasons';
import TooltipHydration from './TooltipHydration.test.vue';

type Details = Tooltip.Root.ChangeEventDetails;

function reasons(onOpenChange: ReturnType<typeof vi.fn>) {
  return onOpenChange.mock.calls.map((call) => [call[0], call[1].reason]);
}

function getTrigger(name = 'Trigger') {
  return screen.getByRole('button', { name });
}

describe('<Tooltip.Root />', () => {
  const { render } = createRenderer();

  it('keeps the payload while a controlled reopen moves to another trigger', async () => {
    const handle = Tooltip.createHandle<string>();
    const payloads: Array<string | undefined> = [];
    const state = shallowRef<{ open: boolean; triggerId: string | null }>({
      open: true,
      triggerId: 'first',
    });

    const App = defineComponent({
      setup: () => () => (
        <>
          <Tooltip.Trigger handle={handle} id="first" payload="First">
            First
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={handle} id="second" payload="Second">
            Second
          </Tooltip.Trigger>
          <Tooltip.Root handle={handle} open={state.value.open} triggerId={state.value.triggerId}>
            {{
              default: ({ payload }: { payload: string | undefined }) => {
                payloads.push(payload);
                return (
                  <Tooltip.Portal>
                    <Tooltip.Positioner>
                      <Tooltip.Popup>{payload}</Tooltip.Popup>
                    </Tooltip.Positioner>
                  </Tooltip.Portal>
                );
              },
            }}
          </Tooltip.Root>
        </>
      ),
    });

    await render(<App />);
    await flushMicrotasks();
    state.value = { open: false, triggerId: null };
    await flushMicrotasks();

    payloads.length = 0;
    state.value = { open: true, triggerId: 'second' };
    await flushMicrotasks();

    expect(payloads).not.toContain(undefined);
    expect(payloads.at(-1)).toBe('Second');
  });

  popupConformanceTests({
    createComponent: (props) => (
      <Tooltip.Root {...props.root}>
        <Tooltip.Trigger {...props.trigger}>Open menu</Tooltip.Trigger>
        <Tooltip.Portal {...props.portal}>
          <Tooltip.Positioner>
            <Tooltip.Popup {...props.popup}>Content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ),
    render,
    triggerMouseAction: 'hover',
  });

  describe('preventUnmountOnClose()', () => {
    it('unmounts on a normal close after a prevented close and initially open remount', async () => {
      const tooltip = Tooltip.createHandle();
      const showRoot = shallowRef(true);
      const remountOpen = shallowRef(false);
      let preventNextUnmount = true;

      const App = defineComponent({
        setup: () => () => (
          <>
            <Tooltip.Trigger handle={tooltip} id="trigger" delay={0}>
              Toggle
            </Tooltip.Trigger>
            <button type="button" onClick={() => tooltip.open('trigger')}>
              Open tooltip
            </button>
            <button type="button" onClick={() => tooltip.close()}>
              Close tooltip
            </button>
            <button
              type="button"
              onClick={() => {
                showRoot.value = false;
              }}
            >
              Unmount root
            </button>
            <button
              type="button"
              onClick={() => {
                remountOpen.value = true;
                showRoot.value = true;
              }}
            >
              Remount open
            </button>
            {showRoot.value && (
              <Tooltip.Root
                handle={tooltip}
                defaultOpen={remountOpen.value}
                defaultTriggerId="trigger"
                onOpenChange={(open: boolean, details: Details) => {
                  if (!open && preventNextUnmount) {
                    preventNextUnmount = false;
                    details.preventUnmountOnClose();
                  }
                }}
              >
                <Tooltip.Portal>
                  <Tooltip.Positioner data-testid="positioner">
                    <Tooltip.Popup>Content</Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
            )}
          </>
        ),
      });

      const { user } = await render(<App />);
      const trigger = screen.getByRole('button', { name: 'Toggle' });

      await user.click(screen.getByRole('button', { name: 'Open tooltip' }));
      await screen.findByTestId('positioner');

      await user.click(screen.getByRole('button', { name: 'Close tooltip' }));
      await flushMicrotasks();
      expect(trigger).not.toHaveAttribute('data-popup-open');
      expect(screen.queryByTestId('positioner')).not.toBe(null);

      await user.click(screen.getByRole('button', { name: 'Unmount root' }));
      await flushMicrotasks();
      expect(screen.queryByTestId('positioner')).toBe(null);

      await user.click(screen.getByRole('button', { name: 'Remount open' }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Toggle' })).toHaveAttribute('data-popup-open');
      });
      await flushMicrotasks();
      expect(screen.queryByTestId('positioner')).not.toBe(null);

      await user.click(screen.getByRole('button', { name: 'Close tooltip' }));
      await waitFor(() => {
        expect(screen.queryByTestId('positioner')).toBe(null);
      });
    });
  });

  describe('close requests', () => {
    it('reports the active trigger for an Escape close', async () => {
      const onOpenChange = vi.fn();
      const { user } = await render(
        <Tooltip.Root defaultOpen onOpenChange={onOpenChange}>
          <Tooltip.Trigger>Trigger</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>Content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>,
      );
      await flushMicrotasks();
      expect(screen.queryByText('Content')).not.toBe(null);

      await user.keyboard('[Escape]');

      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange.mock.calls[0][1].reason).toBe(REASONS.escapeKey);
      expect(onOpenChange.mock.calls[0][1].trigger).toBe(
        screen.getByRole('button', { name: 'Trigger' }),
      );
    });
  });

  describe('open state', () => {
    it('follows `v-model:open`, and emits `openChange` before `update:open`', async () => {
      const open = shallowRef(false);
      const events: unknown[][] = [];
      const App = defineComponent({
        setup: () => () => (
          <Tooltip.Root
            open={open.value}
            onOpenChange={(next: boolean, details: Details) => {
              events.push(['openChange', next, details.reason]);
            }}
            {...{
              'onUpdate:open': (next: boolean) => {
                events.push(['update:open', next]);
                open.value = next;
              },
            }}
          >
            <Tooltip.Trigger style={{ pointerEvents: 'none' }}>Trigger</Tooltip.Trigger>
          </Tooltip.Root>
        ),
      });
      const { user } = await render(<App />);
      expect(getTrigger()).not.toHaveAttribute('data-popup-open');

      open.value = true;
      await flushMicrotasks();
      expect(getTrigger()).toHaveAttribute('data-popup-open');
      expect(events).toEqual([]);

      await user.keyboard('[Escape]');
      await flushMicrotasks();

      expect(getTrigger()).not.toHaveAttribute('data-popup-open');
      expect(events).toEqual([
        ['openChange', false, 'escape-key'],
        ['update:open', false],
      ]);
    });

    it('does not emit `update:open` for a canceled change, and stays open', async () => {
      const onUpdateOpen = vi.fn();
      const { user } = await render(
        <Tooltip.Root
          defaultOpen
          onOpenChange={(_next: boolean, details: Details) => details.cancel()}
          {...{ 'onUpdate:open': onUpdateOpen }}
        >
          <Tooltip.Trigger>Trigger</Tooltip.Trigger>
        </Tooltip.Root>,
      );
      await flushMicrotasks();

      await user.keyboard('[Escape]');
      await flushMicrotasks();

      expect(onUpdateOpen).not.toHaveBeenCalled();
      expect(getTrigger()).toHaveAttribute('data-popup-open');
    });

    it('gives the trigger an id and no ARIA attribute', async () => {
      await render(
        <Tooltip.Root defaultOpen>
          <Tooltip.Trigger>Trigger</Tooltip.Trigger>
        </Tooltip.Root>,
      );
      await flushMicrotasks();
      const trigger = getTrigger();

      expect(trigger.id).not.toBe('');
      expect(trigger.getAttributeNames().filter((name) => name.startsWith('aria-'))).toEqual([]);
    });
  });

  describe('dismissal', () => {
    it('closes on a press outside the trigger', async () => {
      const onOpenChange = vi.fn();
      const { user } = await render(
        <div>
          <button>Outside</button>
          <Tooltip.Root defaultOpen onOpenChange={onOpenChange}>
            <Tooltip.Trigger>Trigger</Tooltip.Trigger>
          </Tooltip.Root>
        </div>,
      );
      await flushMicrotasks();

      await user.click(getTrigger('Outside'));

      expect(reasons(onOpenChange)).toEqual([[false, 'outside-press']]);
    });

    it.each([
      { name: 'closes on a click on its trigger', closeOnClick: true, expected: ['trigger-press'] },
      { name: 'stays open with `closeOnClick` false', closeOnClick: false, expected: [] },
    ])('$name', async ({ closeOnClick, expected }) => {
      const onOpenChange = vi.fn();
      const { user } = await render(
        <Tooltip.Root defaultOpen onOpenChange={onOpenChange}>
          <Tooltip.Trigger closeOnClick={closeOnClick}>Trigger</Tooltip.Trigger>
        </Tooltip.Root>,
      );
      await flushMicrotasks();

      await user.click(getTrigger());
      await flushMicrotasks();

      expect(onOpenChange.mock.calls.map((call) => call[1].reason)).toEqual(expected);
      expect(getTrigger().hasAttribute('data-popup-open')).toBe(!closeOnClick);
    });
  });

  describe('prop: disabled', () => {
    it('closes an open tooltip with the reason `disabled` at the mount, and marks its trigger while it is disabled', async () => {
      const disabled = shallowRef(true);
      const onOpenChange = vi.fn();
      const App = defineComponent({
        setup: () => () => (
          <Tooltip.Root defaultOpen disabled={disabled.value} onOpenChange={onOpenChange}>
            <Tooltip.Trigger>Trigger</Tooltip.Trigger>
          </Tooltip.Root>
        ),
      });
      await render(<App />);
      await flushMicrotasks();
      const trigger = getTrigger();

      expect(reasons(onOpenChange)).toEqual([[false, 'disabled']]);
      expect(trigger).not.toHaveAttribute('data-popup-open');
      expect(trigger).toHaveAttribute('data-trigger-disabled', '');

      disabled.value = false;
      await flushMicrotasks();
      expect(trigger).not.toHaveAttribute('data-trigger-disabled');
    });

    it('closes when it becomes disabled while it is open', async () => {
      const disabled = shallowRef(false);
      const onOpenChange = vi.fn();
      const App = defineComponent({
        setup: () => () => (
          <Tooltip.Root defaultOpen disabled={disabled.value} onOpenChange={onOpenChange}>
            <Tooltip.Trigger>Trigger</Tooltip.Trigger>
          </Tooltip.Root>
        ),
      });
      await render(<App />);
      await flushMicrotasks();
      expect(getTrigger()).toHaveAttribute('data-popup-open');

      disabled.value = true;
      await flushMicrotasks();

      expect(reasons(onOpenChange)).toEqual([[false, 'disabled']]);
      expect(getTrigger()).not.toHaveAttribute('data-popup-open');
    });

    it('marks a trigger with its own `disabled`, and not the other triggers', async () => {
      await render(
        <Tooltip.Root>
          <Tooltip.Trigger disabled>One</Tooltip.Trigger>
          <Tooltip.Trigger>Two</Tooltip.Trigger>
        </Tooltip.Root>,
      );

      expect(getTrigger('One')).toHaveAttribute('data-trigger-disabled', '');
      expect(getTrigger('Two')).not.toHaveAttribute('data-trigger-disabled');
    });
  });

  describe('handle', () => {
    function renderDetached(handle: Tooltip.Handle<string>, onOpenChange = vi.fn()) {
      return render(
        <div style={{ pointerEvents: 'none' }}>
          <Tooltip.Trigger handle={handle} id="one" payload="first">
            One
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={handle} id="two" payload="second">
            Two
          </Tooltip.Trigger>
          <Tooltip.Root handle={handle} onOpenChange={onOpenChange}>
            {{
              default: ({ payload }: { payload: string | undefined }) => (
                <span data-testid="payload">{payload ?? 'none'}</span>
              ),
            }}
          </Tooltip.Root>
        </div>,
      );
    }

    it('opens for a trigger id with its payload, moves to another trigger and closes', async () => {
      const handle = Tooltip.createHandle<string>();
      const onOpenChange = vi.fn();
      await renderDetached(handle, onOpenChange);
      await flushMicrotasks();

      handle.open('one');
      await flushMicrotasks();
      expect(getTrigger('One')).toHaveAttribute('data-popup-open');
      expect(screen.getByTestId('payload').textContent).toBe('first');

      handle.open('two');
      await flushMicrotasks();
      expect(getTrigger('One')).not.toHaveAttribute('data-popup-open');
      expect(getTrigger('Two')).toHaveAttribute('data-popup-open');
      expect(screen.getByTestId('payload').textContent).toBe('second');

      handle.close();
      await flushMicrotasks();
      expect(getTrigger('Two')).not.toHaveAttribute('data-popup-open');
      expect(reasons(onOpenChange)).toEqual([
        [true, 'imperative-action'],
        [true, 'imperative-action'],
        [false, 'imperative-action'],
      ]);
      expect(onOpenChange.mock.calls[1][1].trigger).toBe(getTrigger('Two'));
    });

    it('throws when `open()` names a trigger that is not registered', async () => {
      const handle = Tooltip.createHandle<string>();
      await renderDetached(handle);
      await flushMicrotasks();

      expect(() => handle.open('missing')).toThrow(
        'Vase UI: TooltipHandle.open() was called with the trigger id "missing"',
      );
    });

    it('VUE-34: a `computed` that reads `isOpen` follows the tooltip and the root', async () => {
      const handle = Tooltip.createHandle<string>();
      const isOpen = computed(() => handle.isOpen);
      expect(isOpen.value).toBe(false);
      const { unmount } = await renderDetached(handle);
      await flushMicrotasks();

      handle.open('one');
      expect(isOpen.value).toBe(true);
      handle.close();
      expect(isOpen.value).toBe(false);
      handle.open('one');
      expect(isOpen.value).toBe(true);

      unmount();
      expect(isOpen.value).toBe(false);
    });
  });

  describe('active trigger', () => {
    it('closes with the reason `none` when the active trigger unmounts', async () => {
      const showFirst = shallowRef(true);
      const onOpenChange = vi.fn();
      const App = defineComponent({
        setup: () => () => (
          <Tooltip.Root defaultOpen defaultTriggerId="one" onOpenChange={onOpenChange}>
            {{
              default: ({ payload }: { payload: string | undefined }) => [
                showFirst.value ? (
                  <Tooltip.Trigger id="one" payload="first">
                    One
                  </Tooltip.Trigger>
                ) : null,
                <Tooltip.Trigger id="two" payload="second">
                  Two
                </Tooltip.Trigger>,
                <span data-testid="payload">{payload ?? 'none'}</span>,
              ],
            }}
          </Tooltip.Root>
        ),
      });
      await render(<App />);
      await waitFor(() => {
        expect(screen.getByTestId('payload').textContent).toBe('first');
      });

      showFirst.value = false;
      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledTimes(1);
      });
      await flushMicrotasks();

      expect(reasons(onOpenChange)).toEqual([[false, 'none']]);
      expect(onOpenChange.mock.calls[0][1].trigger).toBe(undefined);
      expect(getTrigger('Two')).not.toHaveAttribute('data-popup-open');
    });

    it('has no payload while it is open with no active trigger', async () => {
      const open = shallowRef(true);
      const triggerId = shallowRef<string | null>('one');
      const App = defineComponent({
        setup: () => () => (
          <Tooltip.Root open={open.value} triggerId={triggerId.value}>
            {{
              default: ({ payload }: { payload: string | undefined }) => [
                <Tooltip.Trigger id="one" payload="first">
                  One
                </Tooltip.Trigger>,
                <Tooltip.Trigger id="two" payload="second">
                  Two
                </Tooltip.Trigger>,
                <span data-testid="payload">{payload ?? 'none'}</span>,
              ],
            }}
          </Tooltip.Root>
        ),
      });
      await render(<App />);
      await waitFor(() => {
        expect(screen.getByTestId('payload').textContent).toBe('first');
      });

      triggerId.value = null;
      await flushMicrotasks();

      expect(screen.getByTestId('payload').textContent).toBe('none');
    });
  });

  describe('actions', () => {
    it('exposes `close` and `unmount`', async () => {
      let root: Tooltip.Root.Actions | undefined;
      const onOpenChange = vi.fn((_open: boolean, details: Details) => {
        details.preventUnmountOnClose();
      });
      const onOpenChangeComplete = vi.fn();
      const App = defineComponent({
        setup: () => () => (
          <Tooltip.Root
            ref={(instance: unknown) => {
              root = instance as Tooltip.Root.Actions;
            }}
            defaultOpen
            onOpenChange={onOpenChange}
            onOpenChangeComplete={onOpenChangeComplete}
          >
            <Tooltip.Trigger>Trigger</Tooltip.Trigger>
          </Tooltip.Root>
        ),
      });
      await render(<App />);
      await flushMicrotasks();

      root!.close();
      await flushMicrotasks();
      expect(reasons(onOpenChange)).toEqual([[false, 'imperative-action']]);
      expect(getTrigger()).not.toHaveAttribute('data-popup-open');
      expect(onOpenChangeComplete).not.toHaveBeenCalled();

      root!.unmount();
      await flushMicrotasks();
      expect(onOpenChangeComplete.mock.calls).toEqual([[false]]);
    });
  });

  describe('hydration', () => {
    it.each([
      { name: 'a closed tooltip', props: {}, payload: 'none' },
      // The first trigger that registers claims the tooltip after the mount.
      {
        name: 'an open tooltip with no trigger id',
        props: { defaultOpen: true },
        payload: 'first',
      },
      {
        name: 'an open tooltip with a trigger id',
        props: { defaultOpen: true, defaultTriggerId: 'two' },
        payload: 'second',
      },
    ])('hydrates the server HTML of $name', async ({ props, payload }) => {
      const serverHtml = await renderOnServer('src/tooltip/root/TooltipHydration.test.vue', props);

      const { container } = await hydrate(TooltipHydration, { serverHtml, props });

      expect(container.querySelector('[data-testid="payload"]')?.textContent).toBe(payload);
    });
  });
});
