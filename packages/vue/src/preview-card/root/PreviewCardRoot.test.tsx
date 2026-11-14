import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { computed, defineComponent, shallowRef } from 'vue';
import type { PropType } from 'vue';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  hydrate,
  popupConformanceTests,
  renderOnServer,
  screen,
  waitFor,
} from '#test-utils';
import { REASONS } from '../../internals/reasons';
import { useFloatingParentNodeId, useFloatingTree } from '../../utils/popups/tree/FloatingTree';
import * as PreviewCard from '../index.parts';
import { CLOSE_DELAY, OPEN_DELAY } from '../utils/constants';
import PreviewCardRootHydration from './PreviewCardRootHydration.test.vue';

const HYDRATION_FIXTURE = 'src/preview-card/root/PreviewCardRootHydration.test.vue';

// The real pointer of the browser can rest on a link. A dispatched event still reaches the link,
// and the real pointer sends no event of its own.
const noRealPointer = { pointerEvents: 'none' } as const;

const testPreviewCardProps = {
  rootProps: Object as PropType<Record<string, unknown>>,
  triggerProps: Object as PropType<Record<string, unknown>>,
};

function renderPopup() {
  return (
    <PreviewCard.Portal>
      <PreviewCard.Positioner data-testid="positioner">
        <PreviewCard.Popup data-testid="popup">Content</PreviewCard.Popup>
      </PreviewCard.Positioner>
    </PreviewCard.Portal>
  );
}

const ContainedTriggerPreviewCard = defineComponent({
  props: testPreviewCardProps,
  setup: (props) => () => (
    <PreviewCard.Root {...props.rootProps}>
      <PreviewCard.Trigger href="#" data-testid="trigger" {...props.triggerProps}>
        Link
      </PreviewCard.Trigger>
      {renderPopup()}
    </PreviewCard.Root>
  ),
});

const DetachedTriggerPreviewCard = defineComponent({
  props: testPreviewCardProps,
  setup(props) {
    const previewCardHandle = PreviewCard.createHandle();

    return () => (
      <>
        <PreviewCard.Trigger
          href="#"
          data-testid="trigger"
          {...props.triggerProps}
          handle={previewCardHandle}
        >
          Link
        </PreviewCard.Trigger>
        <PreviewCard.Root {...props.rootProps} handle={previewCardHandle}>
          {renderPopup()}
        </PreviewCard.Root>
      </>
    );
  },
});

const MultipleDetachedTriggersPreviewCard = defineComponent({
  props: testPreviewCardProps,
  setup(props) {
    const previewCardHandle = PreviewCard.createHandle();

    return () => (
      <>
        <PreviewCard.Trigger
          href="#"
          data-testid="trigger"
          {...props.triggerProps}
          handle={previewCardHandle}
        >
          Link
        </PreviewCard.Trigger>
        <PreviewCard.Trigger href="#" data-testid="trigger-2" handle={previewCardHandle}>
          Another link
        </PreviewCard.Trigger>

        <PreviewCard.Root {...props.rootProps} handle={previewCardHandle}>
          {renderPopup()}
        </PreviewCard.Root>
      </>
    );
  },
});

describe('<PreviewCard.Root />', () => {
  const { render } = createRenderer();

  it('keeps the payload while a controlled reopen moves to another trigger', async () => {
    const handle = PreviewCard.createHandle<string>();
    const payloads: Array<string | undefined> = [];
    const state = shallowRef<{ open: boolean; triggerId: string | null }>({
      open: true,
      triggerId: 'first',
    });

    const App = defineComponent({
      setup: () => () => (
        <>
          <PreviewCard.Trigger handle={handle} id="first" payload="First">
            First
          </PreviewCard.Trigger>
          <PreviewCard.Trigger handle={handle} id="second" payload="Second">
            Second
          </PreviewCard.Trigger>
          <PreviewCard.Root
            handle={handle}
            open={state.value.open}
            triggerId={state.value.triggerId}
          >
            {{
              default: ({ payload }: { payload: string | undefined }) => {
                payloads.push(payload);
                return (
                  <PreviewCard.Portal>
                    <PreviewCard.Positioner>
                      <PreviewCard.Popup>{payload}</PreviewCard.Popup>
                    </PreviewCard.Positioner>
                  </PreviewCard.Portal>
                );
              },
            }}
          </PreviewCard.Root>
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
      <PreviewCard.Root {...props.root}>
        <PreviewCard.Trigger href="#" {...props.trigger}>
          Link
        </PreviewCard.Trigger>
        <PreviewCard.Portal {...props.portal}>
          <PreviewCard.Positioner>
            <PreviewCard.Popup {...props.popup}>Content</PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    ),
    render,
    triggerMouseAction: 'hover',
  });

  async function tick(ms: number) {
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(ms);
    await flushMicrotasks();
  }

  describe.for([
    { name: 'contained triggers', Component: ContainedTriggerPreviewCard },
    { name: 'detached triggers', Component: DetachedTriggerPreviewCard },
    { name: 'multiple detached triggers', Component: MultipleDetachedTriggersPreviewCard },
  ])('when using $name', ({ Component: TestPreviewCard }) => {
    describe('uncontrolled open', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('should open when the trigger is hovered', async () => {
        await render(<TestPreviewCard />);

        const trigger = screen.getByRole('link', { name: 'Link' });

        await fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        await fireEvent.mouseEnter(trigger);
        await fireEvent.mouseMove(trigger);

        await tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });

      it('should close when the trigger is unhovered', async () => {
        await render(<TestPreviewCard />);

        const trigger = screen.getByRole('link', { name: 'Link' });

        await fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        await fireEvent.mouseEnter(trigger);
        await fireEvent.mouseMove(trigger);

        await tick(OPEN_DELAY);

        await flushMicrotasks();

        await fireEvent.mouseLeave(trigger);

        await flushMicrotasks();

        await tick(CLOSE_DELAY);

        expect(screen.queryByText('Content')).toBe(null);
      });
    });

    describe('prop: onOpenChange', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('should call onOpenChange when the open state changes', async () => {
        const handleChange = vi.fn();

        const App = defineComponent({
          setup() {
            const open = shallowRef(false);

            return () => (
              <TestPreviewCard
                rootProps={{
                  open: open.value,
                  onOpenChange: (nextOpen: boolean) => {
                    handleChange(open.value);
                    open.value = nextOpen;
                  },
                }}
              />
            );
          },
        });

        await render(<App />);

        expect(screen.queryByText('Content')).toBe(null);

        const trigger = screen.getByRole('link', { name: 'Link' });

        await fireEvent.mouseEnter(trigger);
        await fireEvent.mouseMove(trigger);

        await tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        await fireEvent.mouseLeave(trigger);

        await flushMicrotasks();

        await tick(CLOSE_DELAY);

        expect(screen.queryByText('Content')).toBe(null);
        expect(handleChange.mock.calls.length).toBe(2);
        expect(handleChange.mock.calls[0][0]).toBe(false);
        expect(handleChange.mock.calls[1][0]).toBe(true);
      });

      it('does not close after hovering out of a popup opened externally', async () => {
        const App = defineComponent({
          setup() {
            const open = shallowRef(false);

            return () => (
              <>
                <button
                  type="button"
                  onClick={() => {
                    open.value = true;
                  }}
                >
                  Show
                </button>
                <TestPreviewCard
                  rootProps={{
                    open: open.value,
                    onOpenChange: (nextOpen: boolean) => {
                      open.value = nextOpen;
                    },
                  }}
                />
              </>
            );
          },
        });

        await render(<App />);

        await fireEvent.click(screen.getByRole('button', { name: 'Show' }));
        await flushMicrotasks();

        expect(screen.queryByText('Content')).not.toBe(null);

        const positioner = screen.getByTestId('positioner');

        await fireEvent.mouseEnter(positioner);
        await fireEvent.mouseLeave(positioner);

        await flushMicrotasks();

        await tick(CLOSE_DELAY);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).not.toBe(null);
      });

      it('closes after hovering out of a popup opened by its trigger', async () => {
        const App = defineComponent({
          setup() {
            const open = shallowRef(false);

            return () => (
              <TestPreviewCard
                rootProps={{
                  open: open.value,
                  onOpenChange: (nextOpen: boolean) => {
                    open.value = nextOpen;
                  },
                }}
              />
            );
          },
        });

        await render(<App />);

        const trigger = screen.getByRole('link', { name: 'Link' });

        await fireEvent.mouseEnter(trigger);
        await fireEvent.mouseMove(trigger);

        await tick(OPEN_DELAY);
        await flushMicrotasks();

        expect(screen.queryByText('Content')).not.toBe(null);

        const positioner = screen.getByTestId('positioner');

        await fireEvent.mouseEnter(positioner);
        await fireEvent.mouseLeave(positioner);

        await flushMicrotasks();

        await tick(CLOSE_DELAY);
        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('does not call onOpenChange again when the trigger is re-hovered while open', async () => {
        const handleChange = vi.fn();

        const App = defineComponent({
          setup() {
            const open = shallowRef(false);

            return () => (
              <TestPreviewCard
                rootProps={{
                  open: open.value,
                  onOpenChange: (nextOpen: boolean) => {
                    handleChange(open.value);
                    open.value = nextOpen;
                  },
                }}
              />
            );
          },
        });

        await render(<App />);

        expect(screen.queryByText('Content')).toBe(null);

        const trigger = screen.getByRole('link', { name: 'Link' });

        await fireEvent.mouseEnter(trigger);
        await fireEvent.mouseMove(trigger);

        await tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
        expect(handleChange).toHaveBeenCalledTimes(1);

        // Leave and re-enter before the close delay runs out: the card stays open.
        await fireEvent.mouseLeave(trigger);
        await fireEvent.mouseEnter(trigger);
        await fireEvent.mouseMove(trigger);

        await tick(OPEN_DELAY);
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
        expect(handleChange).toHaveBeenCalledTimes(1);
        expect(handleChange).toHaveBeenNthCalledWith(1, false);
      });
    });

    describe('prop: defaultOpen', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('closes when the trigger is unhovered after opening by default', async () => {
        await render(
          <TestPreviewCard
            rootProps={{
              defaultOpen: true,
            }}
          />,
        );
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        const trigger = screen.getByRole('link', { name: 'Link' });

        await fireEvent.mouseLeave(trigger);

        await flushMicrotasks();

        await tick(CLOSE_DELAY);

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('does not close after hovering out of a popup opened without trigger hover', async () => {
        await render(
          <TestPreviewCard
            rootProps={{
              defaultOpen: true,
            }}
          />,
        );
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        const positioner = screen.getByTestId('positioner');

        await fireEvent.mouseEnter(positioner);
        await fireEvent.mouseLeave(positioner);

        await flushMicrotasks();

        await tick(CLOSE_DELAY);
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });
    });

    describe('prop: delay', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('should open after delay with rest type by default', async () => {
        await render(<TestPreviewCard triggerProps={{ delay: 100 }} />);

        const trigger = screen.getByRole('link', { name: 'Link' });

        await fireEvent.mouseEnter(trigger);
        await fireEvent.mouseMove(trigger);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);

        await tick(100);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });
    });

    describe('prop: closeDelay', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('should close after delay', async () => {
        await render(<TestPreviewCard triggerProps={{ closeDelay: 100 }} />);

        const trigger = screen.getByRole('link', { name: 'Link' });

        await fireEvent.mouseEnter(trigger);
        await fireEvent.mouseMove(trigger);

        await tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        await fireEvent.mouseLeave(trigger);

        expect(screen.getByText('Content')).not.toBe(null);

        await tick(100);

        expect(screen.queryByText('Content')).toBe(null);
      });
    });

    describe('dismissal', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('reopens on hover after Escape closes it', async () => {
        await render(<TestPreviewCard triggerProps={{ delay: 100 }} />);

        const trigger = screen.getByRole('link', { name: 'Link' });

        await fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        await fireEvent.mouseEnter(trigger);
        await fireEvent.mouseMove(trigger);

        await tick(100);
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        await fireEvent.keyDown(document.body, { key: 'Escape' });
        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);

        // Re-enter with mouse events only. A fresh pointerenter can be missed
        // after the click-driven close, but hover should still work.
        await fireEvent.mouseEnter(trigger);
        await fireEvent.mouseMove(trigger);

        await tick(100);
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });
    });

    describe('prop: actionsRef', () => {
      it('unmounts the preview card when the `unmount` method is called', async () => {
        let actions: PreviewCard.Root.Actions | null = null;

        const { user } = await render(
          <TestPreviewCard
            rootProps={{
              ref: (value: unknown) => {
                actions = value as PreviewCard.Root.Actions | null;
              },
              onOpenChange: (_open: boolean, details: PreviewCard.Root.ChangeEventDetails) => {
                details.preventUnmountOnClose();
              },
            }}
            triggerProps={{
              delay: 0,
              closeDelay: 0,
            }}
          />,
        );

        const trigger = screen.getByRole('link', { name: 'Link' });
        await user.hover(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).not.toBe(null);
        });

        await user.unhover(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).not.toBe(null);
        });

        actions!.unmount();
        await flushMicrotasks();

        expect(screen.queryByTestId('positioner')).toBe(null);
      });

      it('closes the preview card when the `close` method is called', async () => {
        const onOpenChange = vi.fn();
        const onOpenChangeComplete = vi.fn();
        let actions: PreviewCard.Root.Actions | null = null;

        const { user } = await render(
          <TestPreviewCard
            rootProps={{
              ref: (value: unknown) => {
                actions = value as PreviewCard.Root.Actions | null;
              },
              onOpenChange,
              onOpenChangeComplete,
            }}
            triggerProps={{ delay: 0 }}
          />,
        );

        const trigger = screen.getByRole('link', { name: 'Link' });
        await user.hover(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('popup')).not.toBe(null);
        });

        actions!.close();
        await flushMicrotasks();

        // The positioner goes when the close completes.
        await waitFor(() => {
          expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
        });
        expect(screen.queryByTestId('positioner')).toBe(null);

        expect(trigger).not.toHaveAttribute('data-popup-open');
        expect(onOpenChange).toHaveBeenLastCalledWith(
          false,
          expect.objectContaining({ reason: REASONS.imperativeAction }),
        );
      });
    });
  });

  describe('open state', () => {
    // A controlled card whose parent applies each change that `openChange` does not cancel.
    async function renderControlledCard() {
      const events: unknown[] = [];
      const open = shallowRef(true);
      const behavior = { cancel: false };

      const { user } = await render(() => (
        <PreviewCard.Root
          open={open.value}
          onOpenChange={(nextOpen: boolean, details: PreviewCard.Root.ChangeEventDetails) => {
            events.push(['openChange', nextOpen, details.reason, details.trigger?.id]);
            if (behavior.cancel) {
              details.cancel();
            }
          }}
          {...{
            'onUpdate:open': (nextOpen: boolean) => {
              events.push(['update:open', nextOpen]);
              open.value = nextOpen;
            },
          }}
        >
          <PreviewCard.Trigger id="link" href="#preview">
            Link
          </PreviewCard.Trigger>
        </PreviewCard.Root>
      ));

      return { events, open, behavior, user, link: screen.getByRole('link', { name: 'Link' }) };
    }

    it('follows `v-model:open`, and emits `openChange` before `update:open`', async () => {
      const { events, open, user, link } = await renderControlledCard();
      expect(link).toHaveAttribute('data-popup-open');

      await user.keyboard('[Escape]');

      expect(link).not.toHaveAttribute('data-popup-open');
      expect(open.value).toBe(false);
      expect(events).toEqual([
        ['openChange', false, REASONS.escapeKey, 'link'],
        ['update:open', false],
      ]);

      open.value = true;
      await flushMicrotasks();

      expect(link).toHaveAttribute('data-popup-open');
      expect(events).toHaveLength(2);
    });

    it('does not emit `update:open` for a canceled change, and stays open', async () => {
      const { events, behavior, user, link } = await renderControlledCard();
      behavior.cancel = true;

      await user.keyboard('[Escape]');

      expect(link).toHaveAttribute('data-popup-open');
      expect(events).toEqual([['openChange', false, REASONS.escapeKey, 'link']]);
    });
  });

  describe('dismissal', () => {
    it('closes on a press outside the link', async () => {
      const onOpenChange = vi.fn();
      const { user } = await render(
        <div>
          <button type="button">Outside</button>
          <PreviewCard.Root defaultOpen onOpenChange={onOpenChange}>
            <PreviewCard.Trigger href="#preview">Link</PreviewCard.Trigger>
          </PreviewCard.Root>
        </div>,
      );
      const link = screen.getByRole('link', { name: 'Link' });
      expect(link).toHaveAttribute('data-popup-open');

      await user.click(screen.getByRole('button', { name: 'Outside' }));

      expect(link).not.toHaveAttribute('data-popup-open');
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenLastCalledWith(
        false,
        expect.objectContaining({ reason: REASONS.outsidePress, trigger: link }),
      );
    });

    it('closes on Escape while the link has the focus, and stops the key', async () => {
      const onKeydown = vi.fn();
      const { user } = await render(
        <div onKeydown={onKeydown}>
          <PreviewCard.Root defaultOpen>
            <PreviewCard.Trigger href="#preview">Link</PreviewCard.Trigger>
          </PreviewCard.Root>
        </div>,
      );
      const link = screen.getByRole('link', { name: 'Link' });
      await user.tab();
      expect(link).toHaveFocus();

      await user.keyboard('[Escape]');

      expect(link).not.toHaveAttribute('data-popup-open');
      expect(onKeydown).not.toHaveBeenCalled();
    });

    it('stays open on a click of its link, and the click navigates', async () => {
      onTestFinished(() => {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      });
      const onOpenChange = vi.fn();
      const { user } = await render(
        <PreviewCard.Root defaultOpen onOpenChange={onOpenChange}>
          <PreviewCard.Trigger href="#preview-card-target">Link</PreviewCard.Trigger>
        </PreviewCard.Root>,
      );
      const link = screen.getByRole('link', { name: 'Link' });

      await user.click(link);

      expect(window.location.hash).toBe('#preview-card-target');
      expect(link).toHaveAttribute('data-popup-open');
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });

  describe('handle', () => {
    it('opens for a trigger id with its payload, moves to another trigger and closes', async () => {
      const handle = PreviewCard.createHandle<string>();
      const events: unknown[] = [];
      await render(
        <div>
          <PreviewCard.Trigger
            handle={handle}
            id="first"
            payload="First"
            href="#first"
            style={noRealPointer}
          >
            First
          </PreviewCard.Trigger>
          <PreviewCard.Trigger
            handle={handle}
            id="second"
            payload="Second"
            href="#second"
            style={noRealPointer}
          >
            Second
          </PreviewCard.Trigger>
          <PreviewCard.Root
            handle={handle}
            onOpenChange={(nextOpen: boolean, details: PreviewCard.Root.ChangeEventDetails) => {
              events.push([nextOpen, details.reason, details.trigger?.id]);
            }}
          >
            {{
              default: ({ payload }: { payload: string | undefined }) => (
                <span data-testid="payload">{payload ?? 'none'}</span>
              ),
            }}
          </PreviewCard.Root>
        </div>,
      );
      const first = screen.getByRole('link', { name: 'First' });
      const second = screen.getByRole('link', { name: 'Second' });
      const payload = screen.getByTestId('payload');
      expect(payload.textContent).toBe('none');

      handle.open('first');
      await flushMicrotasks();
      expect(payload.textContent).toBe('First');
      expect(first).toHaveAttribute('data-popup-open');
      expect(second).not.toHaveAttribute('data-popup-open');

      handle.open('second');
      await flushMicrotasks();
      expect(payload.textContent).toBe('Second');
      expect(first).not.toHaveAttribute('data-popup-open');
      expect(second).toHaveAttribute('data-popup-open');

      handle.close();
      await flushMicrotasks();
      expect(first).not.toHaveAttribute('data-popup-open');
      expect(second).not.toHaveAttribute('data-popup-open');
      expect(events).toEqual([
        [true, REASONS.imperativeAction, 'first'],
        [true, REASONS.imperativeAction, 'second'],
        [false, REASONS.imperativeAction, 'second'],
      ]);
    });

    it('throws when `open()` names a trigger that is not registered', async () => {
      const handle = PreviewCard.createHandle();
      await render(
        <div>
          <PreviewCard.Trigger handle={handle} id="link" href="#link">
            Link
          </PreviewCard.Trigger>
          <PreviewCard.Root handle={handle} />
        </div>,
      );

      expect(() => handle.open('missing')).toThrow(
        'Vase UI: PreviewCardHandle.open() was called with the trigger id "missing"',
      );
      expect(handle.isOpen).toBe(false);
    });

    it('a `computed` that reads `isOpen` follows the card and the root', async () => {
      const handle = PreviewCard.createHandle();
      const isOpen = computed(() => handle.isOpen);
      expect(isOpen.value).toBe(false);

      const { unmount } = await render(
        <div>
          <PreviewCard.Trigger handle={handle} id="link" href="#link">
            Link
          </PreviewCard.Trigger>
          <PreviewCard.Root handle={handle} />
        </div>,
      );
      expect(isOpen.value).toBe(false);

      handle.open('link');
      expect(isOpen.value).toBe(true);

      handle.close();
      expect(isOpen.value).toBe(false);

      handle.open('link');
      expect(isOpen.value).toBe(true);

      unmount();
      expect(isOpen.value).toBe(false);
    });
  });

  describe('active trigger', () => {
    it('closes with the reason `none` when the active trigger unmounts', async () => {
      const firstMounted = shallowRef(true);
      const events: unknown[] = [];
      await render(() => (
        <PreviewCard.Root
          defaultOpen
          defaultTriggerId="first"
          onOpenChange={(nextOpen: boolean, details: PreviewCard.Root.ChangeEventDetails) => {
            events.push([nextOpen, details.reason, details.trigger]);
          }}
        >
          {firstMounted.value ? (
            <PreviewCard.Trigger id="first" href="#first">
              First
            </PreviewCard.Trigger>
          ) : null}
          <PreviewCard.Trigger id="second" href="#second">
            Second
          </PreviewCard.Trigger>
        </PreviewCard.Root>
      ));
      expect(screen.getByRole('link', { name: 'First' })).toHaveAttribute('data-popup-open');

      firstMounted.value = false;
      await flushMicrotasks();

      expect(events).toEqual([[false, REASONS.none, undefined]]);
      expect(screen.getByRole('link', { name: 'Second' })).not.toHaveAttribute('data-popup-open');
    });

    it('has no payload while it is open with no active trigger', async () => {
      const linkMounted = shallowRef(true);
      await render(() => (
        <PreviewCard.Root open>
          {{
            default: ({ payload }: { payload: unknown }) => (
              <>
                {linkMounted.value ? (
                  <PreviewCard.Trigger id="link" href="#link" payload="First">
                    Link
                  </PreviewCard.Trigger>
                ) : null}
                <span data-testid="payload">{String(payload ?? 'none')}</span>
              </>
            ),
          }}
        </PreviewCard.Root>
      ));
      expect(screen.getByTestId('payload').textContent).toBe('First');

      linkMounted.value = false;
      await flushMicrotasks();

      expect(screen.getByTestId('payload').textContent).toBe('none');
    });
  });

  describe('nested preview card interactions', () => {
    it('keeps the parent preview card open when clicking nested trigger', async () => {
      await render(
        <PreviewCard.Root defaultOpen>
          <PreviewCard.Trigger href="#">Parent</PreviewCard.Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner>
              <PreviewCard.Popup data-testid="parent-popup">
                <PreviewCard.Root>
                  <PreviewCard.Trigger href="#">Child</PreviewCard.Trigger>
                  <PreviewCard.Portal>
                    <PreviewCard.Positioner>
                      <PreviewCard.Popup data-testid="child-popup">Child content</PreviewCard.Popup>
                    </PreviewCard.Positioner>
                  </PreviewCard.Portal>
                </PreviewCard.Root>
              </PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>,
      );
      await flushMicrotasks();

      expect(screen.queryByTestId('parent-popup')).not.toBe(null);

      const childTrigger = screen.getByRole('link', { name: 'Child' });

      await fireEvent.click(childTrigger);

      await flushMicrotasks();

      // Parent popup should still be open after clicking the child trigger
      expect(screen.queryByTestId('parent-popup')).not.toBe(null);
    });

    it('keeps the parent preview card open when press starts in nested popup and ends outside', async () => {
      await render(
        <div>
          <button type="button" data-testid="outside">
            Outside
          </button>

          <PreviewCard.Root defaultOpen>
            <PreviewCard.Trigger href="#">Parent</PreviewCard.Trigger>
            <PreviewCard.Portal>
              <PreviewCard.Positioner>
                <PreviewCard.Popup data-testid="parent-popup">
                  <PreviewCard.Root defaultOpen>
                    <PreviewCard.Trigger href="#">Child</PreviewCard.Trigger>
                    <PreviewCard.Portal>
                      <PreviewCard.Positioner>
                        <PreviewCard.Popup data-testid="child-popup">
                          Child content
                        </PreviewCard.Popup>
                      </PreviewCard.Positioner>
                    </PreviewCard.Portal>
                  </PreviewCard.Root>
                </PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
        </div>,
      );
      await flushMicrotasks();

      expect(screen.queryByTestId('parent-popup')).not.toBe(null);
      expect(screen.queryByTestId('child-popup')).not.toBe(null);

      const childPopup = screen.getByTestId('child-popup');
      const outside = screen.getByTestId('outside');

      await fireEvent.pointerDown(childPopup, { pointerType: 'mouse', button: 0 });
      await fireEvent.click(outside);
      await flushMicrotasks();

      expect(screen.queryByTestId('parent-popup')).not.toBe(null);
      expect(screen.queryByTestId('child-popup')).not.toBe(null);
    });

    it('keeps the parent preview card open when hovering nested trigger', async () => {
      await render(
        <PreviewCard.Root defaultOpen>
          <PreviewCard.Trigger href="#">Parent</PreviewCard.Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner data-testid="parent-positioner">
              <PreviewCard.Popup data-testid="parent-popup">
                <div>Parent content</div>
                <PreviewCard.Root>
                  <PreviewCard.Trigger href="#" data-testid="child-trigger">
                    Child
                  </PreviewCard.Trigger>
                  <PreviewCard.Portal>
                    <PreviewCard.Positioner>
                      <PreviewCard.Popup data-testid="child-popup">Child content</PreviewCard.Popup>
                    </PreviewCard.Positioner>
                  </PreviewCard.Portal>
                </PreviewCard.Root>
              </PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>,
      );
      await flushMicrotasks();

      expect(screen.queryByTestId('parent-popup')).not.toBe(null);

      const childTrigger = screen.getByTestId('child-trigger');

      // Simulate hovering from parent content to child trigger
      await fireEvent.pointerDown(childTrigger, { pointerType: 'mouse' });
      await fireEvent.mouseEnter(childTrigger);
      await fireEvent.mouseMove(childTrigger);

      await flushMicrotasks();

      // Parent popup should still be open after hovering the child trigger
      expect(screen.queryByTestId('parent-popup')).not.toBe(null);
    });

    describe('race condition between close timers and hover-open logic', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('keeps the parent open and re-opens the child when re-entering after partial close', async () => {
        await render(
          <PreviewCard.Root defaultOpen>
            <PreviewCard.Trigger href="#" data-testid="parent-trigger">
              Parent
            </PreviewCard.Trigger>
            <PreviewCard.Portal>
              <PreviewCard.Positioner>
                <PreviewCard.Popup data-testid="parent-popup">
                  <div>Parent content</div>
                  <PreviewCard.Root>
                    <PreviewCard.Trigger href="#" data-testid="child-trigger">
                      Child
                    </PreviewCard.Trigger>
                    <PreviewCard.Portal>
                      <PreviewCard.Positioner>
                        <PreviewCard.Popup data-testid="child-popup">
                          Child content
                        </PreviewCard.Popup>
                      </PreviewCard.Positioner>
                    </PreviewCard.Portal>
                  </PreviewCard.Root>
                </PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>,
        );
        await flushMicrotasks();

        // Events must be triggered on positioner elements (parent of popup)
        const parentPopup = screen.getByTestId('parent-popup').parentElement!;
        const childTrigger = screen.getByTestId('child-trigger');

        await fireEvent.mouseEnter(childTrigger);
        await fireEvent.mouseMove(childTrigger);

        await tick(OPEN_DELAY);
        await flushMicrotasks();

        let childPopup = screen.getByTestId('child-popup').parentElement!;

        // Step 3: Move mouse outside all previews
        await fireEvent.mouseLeave(childPopup);
        await fireEvent.mouseLeave(parentPopup);
        await fireEvent.mouseMove(document.body);

        // Advance partway through close delay but not all the way
        await tick(CLOSE_DELAY / 2);
        await flushMicrotasks();

        // Step 4: Re-enter parent popup before it closes
        await fireEvent.mouseEnter(parentPopup);

        // Let the child's close delay finish — child closes
        await tick(CLOSE_DELAY);
        await flushMicrotasks();

        // Parent should still be open
        expect(screen.queryByTestId('parent-popup')).not.toBe(null);
        expect(screen.queryByTestId('child-popup')).toBe(null);

        // Step 5: Hover child trigger again to re-open child
        await fireEvent.mouseEnter(childTrigger);
        await fireEvent.mouseMove(childTrigger);

        await tick(OPEN_DELAY);
        await flushMicrotasks();

        // Parent and child should be open
        expect(screen.queryByTestId('parent-popup')).not.toBe(null);
        childPopup = screen.getByTestId('child-popup').parentElement!;

        await fireEvent.mouseLeave(childTrigger, { relatedTarget: childPopup });
        await fireEvent.mouseLeave(parentPopup, { relatedTarget: childPopup });
        await fireEvent.mouseEnter(childPopup);

        await tick(CLOSE_DELAY);

        expect(screen.queryByTestId('parent-popup')).not.toBe(null);
        expect(screen.queryByTestId('child-popup')).not.toBe(null);
      });
    });

    describe('synchronized closing', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('parent popup closes as soon as the child popup closes', async () => {
        await render(
          <PreviewCard.Root>
            <PreviewCard.Trigger href="#" data-testid="parent-trigger">
              Parent
            </PreviewCard.Trigger>
            <PreviewCard.Portal>
              <PreviewCard.Positioner>
                <PreviewCard.Popup data-testid="parent-popup">
                  <div>Parent content</div>
                  <PreviewCard.Root>
                    <PreviewCard.Trigger href="#" data-testid="child-trigger">
                      Child
                    </PreviewCard.Trigger>
                    <PreviewCard.Portal>
                      <PreviewCard.Positioner>
                        <PreviewCard.Popup data-testid="child-popup">
                          Child content
                        </PreviewCard.Popup>
                      </PreviewCard.Positioner>
                    </PreviewCard.Portal>
                  </PreviewCard.Root>
                </PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>,
        );

        const parentTrigger = screen.getByTestId('parent-trigger');
        await fireEvent.mouseEnter(parentTrigger);
        await tick(OPEN_DELAY);

        // Events must be triggered on positioner elements (parent of popup)
        const parentPopup = screen.getByTestId('parent-popup').parentElement!;
        const childTrigger = screen.getByTestId('child-trigger');

        await fireEvent.mouseLeave(parentTrigger, { relatedTarget: parentPopup });
        await fireEvent.mouseEnter(parentPopup);
        await fireEvent.mouseEnter(childTrigger);
        await tick(OPEN_DELAY);

        const childPopup = screen.getByTestId('child-popup').parentElement!;

        await fireEvent.mouseLeave(childTrigger, { relatedTarget: childPopup });
        await fireEvent.mouseLeave(parentPopup, { relatedTarget: childPopup });
        await fireEvent.mouseEnter(childPopup);
        await fireEvent.mouseLeave(childPopup);
        await fireEvent.mouseMove(document.body);

        await tick(CLOSE_DELAY + 10);
        await flushMicrotasks();

        expect(screen.queryByTestId('child-popup')).toBe(null);
        expect(screen.queryByTestId('parent-popup')).toBe(null);
      });
    });
  });

  describe('popup tree', () => {
    it('registers the node of a nested card below the node of the outer card, in one tree', async () => {
      const probes: Array<{
        tree: ReturnType<typeof useFloatingTree>['value'];
        parentId: string | null;
      }> = [];
      const TreeProbe = defineComponent({
        setup() {
          probes.push({ tree: useFloatingTree().value, parentId: useFloatingParentNodeId().value });
          return () => null;
        },
      });

      await render(
        <PreviewCard.Root defaultOpen>
          <PreviewCard.Trigger href="#">Parent</PreviewCard.Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner>
              <PreviewCard.Popup>
                <TreeProbe />
                <PreviewCard.Root defaultOpen>
                  <PreviewCard.Trigger href="#">Child</PreviewCard.Trigger>
                  <PreviewCard.Portal>
                    <PreviewCard.Positioner>
                      <PreviewCard.Popup>
                        <TreeProbe />
                      </PreviewCard.Popup>
                    </PreviewCard.Positioner>
                  </PreviewCard.Portal>
                </PreviewCard.Root>
              </PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>,
      );
      await flushMicrotasks();

      expect(probes).toHaveLength(2);
      const [outer, inner] = probes;
      expect(outer.tree).not.toBe(null);
      expect(inner.tree).toBe(outer.tree);
      expect(outer.parentId).not.toBe(null);
      const innerNode = outer.tree!.nodesRef.value.find((node) => node.id === inner.parentId);
      expect(innerNode?.parentId).toBe(outer.parentId);
    });

    it('closes only the nested card on Escape while the focus is in the outer card', async () => {
      const onOuterOpenChange = vi.fn();
      const onInnerOpenChange = vi.fn();
      const { user } = await render(
        <PreviewCard.Root defaultOpen onOpenChange={onOuterOpenChange}>
          <PreviewCard.Trigger href="#">Parent</PreviewCard.Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner>
              <PreviewCard.Popup data-testid="parent-popup">
                <button type="button">Action</button>
                <PreviewCard.Root defaultOpen onOpenChange={onInnerOpenChange}>
                  <PreviewCard.Trigger href="#">Child</PreviewCard.Trigger>
                  <PreviewCard.Portal>
                    <PreviewCard.Positioner>
                      <PreviewCard.Popup data-testid="child-popup">Child content</PreviewCard.Popup>
                    </PreviewCard.Positioner>
                  </PreviewCard.Portal>
                </PreviewCard.Root>
              </PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>,
      );
      await flushMicrotasks();
      expect(screen.queryByTestId('child-popup')).not.toBe(null);

      // The key event goes through the popup of the outer card, which finds the open nested card
      // in the tree.
      screen.getByRole('button', { name: 'Action' }).focus();
      await user.keyboard('[Escape]');
      await flushMicrotasks();

      expect(onInnerOpenChange).toHaveBeenCalledTimes(1);
      expect(onInnerOpenChange.mock.calls[0][1].reason).toBe(REASONS.escapeKey);
      expect(onOuterOpenChange).not.toHaveBeenCalled();
      expect(screen.queryByTestId('parent-popup')).not.toBe(null);
    });
  });

  describe('close requests', () => {
    it('reports the active trigger for an Escape close', async () => {
      const onOpenChange = vi.fn();
      const { user } = await render(
        <PreviewCard.Root defaultOpen onOpenChange={onOpenChange}>
          <PreviewCard.Trigger href="#">Trigger</PreviewCard.Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner>
              <PreviewCard.Popup>Content</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>,
      );
      await flushMicrotasks();
      expect(screen.queryByText('Content')).not.toBe(null);

      await user.keyboard('[Escape]');

      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange.mock.calls[0][1].reason).toBe(REASONS.escapeKey);
      expect(onOpenChange.mock.calls[0][1].trigger).toBe(screen.getByText('Trigger'));
    });
  });

  describe('hydration', () => {
    it.each([
      { name: 'a closed card', props: {}, payload: 'none' },
      { name: 'an open card with no trigger id', props: { defaultOpen: true }, payload: 'first' },
      {
        name: 'an open card with a trigger id',
        props: { defaultOpen: true, defaultTriggerId: 'two' },
        payload: 'second',
      },
      { name: 'a closed card that stays mounted', props: { keepMounted: true }, payload: 'none' },
    ])('hydrates the server HTML of $name', async ({ props, payload }) => {
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);

      const { container } = await hydrate(PreviewCardRootHydration, { serverHtml, props });

      expect(container.querySelector('[data-testid="payload"]')?.textContent).toBe(payload);
    });
  });
});
