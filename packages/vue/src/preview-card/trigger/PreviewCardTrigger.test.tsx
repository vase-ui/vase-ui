import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeepAlive, defineComponent, shallowRef } from 'vue';
import type { CSSProperties } from 'vue';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
  takeReportedMessages,
  wait,
  waitFor,
} from '#test-utils';
import { REASONS } from '../../internals/reasons';
import * as PreviewCard from '../index.parts';
import { CLOSE_DELAY, OPEN_DELAY } from '../utils/constants';

describe('<PreviewCard.Trigger />', () => {
  const { render } = createRenderer();

  it('VUE-159: keeps the hover delay when another trigger unmounts', async () => {
    vi.useFakeTimers();
    try {
      const other = shallowRef(true);
      await render(() => (
        <PreviewCard.Root>
          {other.value && <PreviewCard.Trigger id="other" />}
          <PreviewCard.Trigger id="active" data-testid="active" delay={100} />
          <PreviewCard.Portal>
            <PreviewCard.Positioner>
              <PreviewCard.Popup data-testid="card" />
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      ));
      const active = screen.getByTestId('active');
      await fireEvent.mouseEnter(active);
      other.value = false;
      await flushMicrotasks();
      vi.advanceTimersByTime(100);
      await flushMicrotasks();
      expect(screen.getByTestId('card')).toBeVisible();
      expect(active).toHaveAttribute('data-popup-open');
    } finally {
      vi.useRealTimers();
    }
  });

  describeConformance(<PreviewCard.Trigger />, () => ({
    refInstanceof: window.HTMLAnchorElement,
    render(node) {
      return render(<PreviewCard.Root open>{node}</PreviewCard.Root>);
    },
  }));

  async function enter(link: HTMLElement, pointerType = 'mouse') {
    await fireEvent.pointerEnter(link, { pointerType });
    await fireEvent.mouseEnter(link);
  }

  async function renderCard(triggerProps: Record<string, unknown> = {}) {
    const onOpenChange = vi.fn();
    await render(
      <PreviewCard.Root onOpenChange={onOpenChange}>
        <PreviewCard.Trigger href="#preview" {...triggerProps}>
          Link
        </PreviewCard.Trigger>
      </PreviewCard.Root>,
    );
    return { link: screen.getByRole('link', { name: 'Link' }), onOpenChange };
  }

  describe('hover', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    async function tick(ms: number) {
      vi.advanceTimersByTime(ms);
      await flushMicrotasks();
    }

    it.each([
      { name: 'the default delay', props: {}, delay: OPEN_DELAY },
      { name: 'the `delay` prop', props: { delay: 100 }, delay: 100 },
    ])('opens after $name when the pointer enters the link', async ({ props, delay }) => {
      const { link, onOpenChange } = await renderCard(props);

      await enter(link);
      await tick(delay - 1);
      expect(link).not.toHaveAttribute('data-popup-open');

      await tick(1);
      expect(link).toHaveAttribute('data-popup-open');
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenLastCalledWith(
        true,
        expect.objectContaining({ reason: REASONS.triggerHover, trigger: link }),
      );
    });

    it.each([
      { name: 'the default close delay', props: {}, closeDelay: CLOSE_DELAY },
      { name: 'the `closeDelay` prop', props: { closeDelay: 100 }, closeDelay: 100 },
    ])('closes after $name when the pointer leaves the link', async ({ props, closeDelay }) => {
      const { link, onOpenChange } = await renderCard({ delay: 0, ...props });
      await enter(link);
      expect(link).toHaveAttribute('data-popup-open');

      await fireEvent.mouseLeave(link);
      await tick(closeDelay - 1);
      expect(link).toHaveAttribute('data-popup-open');

      await tick(1);
      expect(link).not.toHaveAttribute('data-popup-open');
      expect(onOpenChange).toHaveBeenLastCalledWith(
        false,
        expect.objectContaining({ reason: REASONS.triggerHover, trigger: link }),
      );
    });

    it('does not open for a touch pointer', async () => {
      const { link, onOpenChange } = await renderCard({ delay: 0 });

      await enter(link, 'touch');
      await fireEvent.mouseMove(link);
      await tick(OPEN_DELAY);

      expect(link).not.toHaveAttribute('data-popup-open');
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('VUE-158: closes the old corridor when the open prop closes a kept popup', async () => {
      const open = shallowRef(false);
      await render(() => (
        <PreviewCard.Root open={open.value} onOpenChange={(value) => (open.value = value)}>
          <PreviewCard.Trigger
            href="#preview"
            delay={0}
            closeDelay={0}
            style={{
              position: 'fixed',
              left: '100px',
              top: '120px',
              width: '100px',
              height: '100px',
            }}
          >
            Link
          </PreviewCard.Trigger>
          <PreviewCard.Portal keepMounted>
            <PreviewCard.Positioner side="right" sideOffset={100} data-testid="positioner">
              <PreviewCard.Popup style={{ width: '100px', height: '200px' }} />
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      ));
      const link = screen.getByRole('link', { name: 'Link' });
      await enter(link);
      await flushMicrotasks();
      const anchor = link.getBoundingClientRect();
      const popup = screen.getByTestId('positioner').getBoundingClientRect();
      expect(popup.left).toBeGreaterThan(anchor.right);
      await fireEvent.mouseLeave(link, {
        clientX: anchor.right,
        clientY: anchor.top + anchor.height / 2,
      });
      await fireEvent.mouseMove(document, { clientX: popup.left - 5, clientY: popup.bottom - 10 });
      open.value = false;
      await flushMicrotasks();
      expect(link).not.toHaveAttribute('data-popup-open');
      await enter(link);
      expect(link).toHaveAttribute('data-popup-open');
      await tick(50);
      expect(link).toHaveAttribute('data-popup-open');
    });

    it('stays open while the pointer crosses the gap to the card, and closes when it moves away', async () => {
      await render(
        <PreviewCard.Root>
          <PreviewCard.Trigger href="#preview" delay={0}>
            Link
          </PreviewCard.Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner sideOffset={20} data-testid="positioner">
              <PreviewCard.Popup style={{ width: '200px', height: '100px' }}>
                Card
              </PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>,
      );
      const link = screen.getByRole('link', { name: 'Link' });
      await enter(link);
      await flushMicrotasks();

      const linkRect = link.getBoundingClientRect();
      expect(screen.getByTestId('positioner').getBoundingClientRect().top).toBeGreaterThan(
        linkRect.bottom + 10,
      );
      const x = linkRect.left + linkRect.width / 2;

      await fireEvent.mouseLeave(link, { clientX: x, clientY: linkRect.bottom + 1 });
      await fireEvent.mouseMove(document, { clientX: x, clientY: linkRect.bottom + 10 });
      await tick(CLOSE_DELAY);
      expect(link).toHaveAttribute('data-popup-open');

      await fireEvent.mouseMove(document, { clientX: x, clientY: linkRect.top - 10 });
      await tick(CLOSE_DELAY);
      expect(link).not.toHaveAttribute('data-popup-open');
    });

    it('closes when the pointer stops in the gap, also when another card closes at the same move', async () => {
      const renderLinkWithCard = (name: string, style?: CSSProperties) => (
        <PreviewCard.Root>
          <PreviewCard.Trigger href="#preview" delay={0} closeDelay={0} style={style}>
            {name}
          </PreviewCard.Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner sideOffset={20} data-testid={name}>
              <PreviewCard.Popup style={{ width: '200px', height: '100px' }}>
                Card
              </PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      );
      await render(
        <div>
          {renderLinkWithCard('First')}
          {renderLinkWithCard('Second', { display: 'block', marginTop: '300px' })}
        </div>,
      );
      const first = screen.getByRole('link', { name: 'First' });
      const second = screen.getByRole('link', { name: 'Second' });
      await enter(first);
      await enter(second);
      await flushMicrotasks();

      const firstRect = first.getBoundingClientRect();
      const secondRect = second.getBoundingClientRect();
      expect(screen.getByTestId('First').getBoundingClientRect().top).toBeGreaterThan(
        firstRect.bottom + 15,
      );
      expect(screen.getByTestId('Second').getBoundingClientRect().top).toBeGreaterThan(
        secondRect.bottom + 15,
      );

      await fireEvent.mouseLeave(first, {
        clientX: firstRect.left + firstRect.width / 2,
        clientY: firstRect.bottom + 1,
      });
      await fireEvent.mouseLeave(second, {
        clientX: secondRect.left + secondRect.width / 2,
        clientY: secondRect.bottom + 1,
      });
      // The point is in the safe polygon of the first card, beside the link, and outside the safe
      // polygon of the second card.
      await fireEvent.mouseMove(document, {
        clientX: firstRect.right + 10,
        clientY: firstRect.bottom + 15,
      });
      await tick(39);
      expect(first).toHaveAttribute('data-popup-open');
      expect(second).not.toHaveAttribute('data-popup-open');

      // A safe polygon closes its card 40 ms after the last move in it.
      await tick(1);
      expect(first).not.toHaveAttribute('data-popup-open');
    });
  });

  describe('focus', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it.each([
      { name: 'the default delay', props: {}, delay: OPEN_DELAY },
      { name: 'the `delay` prop', props: { delay: 100 }, delay: 100 },
    ])('opens after $name when the link gets the focus', async ({ props, delay }) => {
      const { link, onOpenChange } = await renderCard(props);

      link.focus();
      await flushMicrotasks();
      vi.advanceTimersByTime(delay - 1);
      await flushMicrotasks();
      expect(link).not.toHaveAttribute('data-popup-open');

      vi.advanceTimersByTime(1);
      await flushMicrotasks();
      expect(link).toHaveAttribute('data-popup-open');
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenLastCalledWith(
        true,
        expect.objectContaining({ reason: REASONS.triggerFocus, trigger: link }),
      );
    });
  });

  it('closes a card that the pointer opened when `KeepAlive` deactivates the link', async () => {
    const onOpenChange = vi.fn();
    const visible = shallowRef(true);
    const Page = defineComponent({
      setup: () => () => (
        <PreviewCard.Root onOpenChange={onOpenChange}>
          <PreviewCard.Trigger href="#preview" delay={0}>
            Link
          </PreviewCard.Trigger>
        </PreviewCard.Root>
      ),
    });
    await render(() => <KeepAlive>{visible.value ? <Page /> : null}</KeepAlive>);

    const link = screen.getByRole('link', { name: 'Link' });
    await enter(link);
    expect(link).toHaveAttribute('data-popup-open');

    visible.value = false;
    await flushMicrotasks();
    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(onOpenChange).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: REASONS.triggerHover }),
    );

    visible.value = true;
    await flushMicrotasks();
    expect(link).not.toHaveAttribute('data-popup-open');
  });

  it('stays closed when focus returns to the trigger after leaving the window, once the card has unmounted', async () => {
    const { user } = await render(
      <PreviewCard.Root>
        <PreviewCard.Trigger href="#" delay={0}>
          Trigger
        </PreviewCard.Trigger>
        <PreviewCard.Portal>
          <PreviewCard.Positioner>
            <PreviewCard.Popup data-testid="popup">Content</PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>,
    );
    const trigger = screen.getByRole('link', { name: 'Trigger' });

    await user.keyboard('[Tab]');
    expect(trigger).toHaveFocus();
    await waitFor(() => {
      expect(screen.getByTestId('popup')).not.toBe(null);
    });

    await user.keyboard('[Escape]');
    expect(screen.queryByTestId('popup')).toBe(null);

    // Leaving the window blurs the trigger, then the window, while the trigger stays the active
    // element; coming back focuses the window, then the trigger.
    await fireEvent.focusOut(trigger);
    await fireEvent.blur(window);
    await fireEvent.focus(window);
    await fireEvent.focusIn(trigger);
    await wait(50);

    expect(screen.queryByTestId('popup')).toBe(null);
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

  it('throws without PreviewCard.Root or a handle', async () => {
    await expect(render(<PreviewCard.Trigger />)).rejects.toThrow(
      'Vase UI: <PreviewCard.Trigger> must be inside <PreviewCard.Root>, or it must have a `handle`. Without a root the trigger has no preview card to open. Put the trigger inside <PreviewCard.Root>, or pass a `handle`.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
