import { describe, expect, it, vi } from 'vitest';
import { computed, defineComponent, shallowRef } from 'vue';
import { Tooltip } from '@vase-ui/vue/tooltip';
import {
  createRenderer,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  waitFor,
} from '#test-utils';
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
    it('closes an open tooltip with the reason `disabled` at the mount and on a change', async () => {
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
    it('closes with the reason `none` when the active trigger unmounts, and clears the payload', async () => {
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
