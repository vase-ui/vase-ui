import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { computed, defineComponent, shallowRef } from 'vue';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  hydrate,
  popupConformanceTests,
  renderOnServer,
  screen,
} from '#test-utils';
import { REASONS } from '../../internals/reasons';
import { useFloatingParentNodeId, useFloatingTree } from '../../utils/popups/tree/FloatingTree';
import * as PreviewCard from '../index.parts';
import PreviewCardRootHydration from './PreviewCardRootHydration.test.vue';

const HYDRATION_FIXTURE = 'src/preview-card/root/PreviewCardRootHydration.test.vue';

// The real pointer of the browser can rest on a link. A dispatched event still reaches the link,
// and the real pointer sends no event of its own.
const noRealPointer = { pointerEvents: 'none' } as const;

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

  describe('actions', () => {
    it('exposes `close` and `unmount`', async () => {
      const onOpenChange = vi.fn();
      const onOpenChangeComplete = vi.fn();
      const actions: { root?: PreviewCard.Root.Actions | null } = {};
      await render(() => (
        <PreviewCard.Root
          ref={(value) => {
            actions.root = value as PreviewCard.Root.Actions | null;
          }}
          defaultOpen
          defaultTriggerId="link"
          onOpenChange={onOpenChange}
          onOpenChangeComplete={onOpenChangeComplete}
        >
          <PreviewCard.Trigger id="link" href="#link">
            Link
          </PreviewCard.Trigger>
        </PreviewCard.Root>
      ));
      const link = screen.getByRole('link', { name: 'Link' });
      expect(link).toHaveAttribute('data-popup-open');

      actions.root!.close();
      await flushMicrotasks();

      expect(link).not.toHaveAttribute('data-popup-open');
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenLastCalledWith(
        false,
        expect.objectContaining({ reason: REASONS.imperativeAction, trigger: link }),
      );

      actions.root!.unmount();
      await flushMicrotasks();

      expect(onOpenChangeComplete).toHaveBeenCalledTimes(1);
      expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
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

    it('closes only the nested card on Escape', async () => {
      const onOuterOpenChange = vi.fn();
      const onInnerOpenChange = vi.fn();
      const { user } = await render(
        <PreviewCard.Root defaultOpen onOpenChange={onOuterOpenChange}>
          <PreviewCard.Trigger href="#">Parent</PreviewCard.Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner>
              <PreviewCard.Popup data-testid="parent-popup">
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
