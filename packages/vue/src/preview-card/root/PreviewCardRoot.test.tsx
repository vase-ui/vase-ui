import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { computed, shallowRef } from 'vue';
import { createRenderer, flushMicrotasks, hydrate, renderOnServer, screen } from '#test-utils';
import { REASONS } from '../../internals/reasons';
import * as PreviewCard from '../index.parts';
import PreviewCardRootHydration from './PreviewCardRootHydration.test.vue';

const HYDRATION_FIXTURE = 'src/preview-card/root/PreviewCardRootHydration.test.vue';

// The real pointer of the browser can rest on a link. A dispatched event still reaches the link,
// and the real pointer sends no event of its own.
const noRealPointer = { pointerEvents: 'none' } as const;

describe('<PreviewCard.Root />', () => {
  const { render } = createRenderer();

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

    it('gives the link an id, and no ARIA attribute, role or tabindex', async () => {
      await render(
        <PreviewCard.Root defaultOpen>
          <PreviewCard.Trigger href="#preview">Link</PreviewCard.Trigger>
        </PreviewCard.Root>,
      );

      const link = screen.getByRole('link', { name: 'Link' });
      expect(link.tagName).toBe('A');
      expect(link.id).toMatch(/^vase-ui-/);
      expect(link.getAttributeNames().sort()).toEqual(['data-popup-open', 'href', 'id']);
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

  describe('hydration', () => {
    it.each([
      { name: 'a closed card', props: {}, payload: 'none' },
      { name: 'an open card with no trigger id', props: { defaultOpen: true }, payload: 'first' },
      {
        name: 'an open card with a trigger id',
        props: { defaultOpen: true, defaultTriggerId: 'two' },
        payload: 'second',
      },
    ])('hydrates the server HTML of $name', async ({ props, payload }) => {
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);

      const { container } = await hydrate(PreviewCardRootHydration, { serverHtml, props });

      expect(container.querySelector('[data-testid="payload"]')?.textContent).toBe(payload);
    });
  });
});
