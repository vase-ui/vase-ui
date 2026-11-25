import { describe, expect, onTestFinished, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { reactive } from 'vue';
import PreviewCardLinks from '../../test/fixtures/PreviewCardLinks.vue';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';
import { linesOf } from './line';

type Props = Record<string, unknown>;

const positioner = () => document.querySelector<HTMLElement>('[data-testid="positioner"]');
const link = (id: string) => document.getElementById(id)!;

/** Waits until the box of the placed positioner passes the check. */
async function placedAt(check: (box: DOMRect) => void) {
  await waitFor(() => {
    expect(positioner()?.style.visibility).toBe('');
    check(positioner()!.getBoundingClientRect());
  });
}

/** Floating UI rounds the place to pixels, and Firefox gives lines a top of half a pixel. */
function expectNear(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);
}

const center = (box: { left: number; right: number }) => (box.left + box.right) / 2;

/** A real pointer that moves to the middle of a line. */
async function hoverLine(id: string, index: number) {
  const line = linesOf(link(id))[index]!;
  await userEvent.pointer({ coords: { x: center(line), y: (line.top + line.bottom) / 2 } });
}

function mountLinks(props: Props = {}) {
  return mount(PreviewCardLinks, { trigger: { delay: 0 }, ...props });
}

describe('the line of a wrapped link', () => {
  test('one box for each line, also where a browser gives more rectangles for one line', () => {
    mountLinks();
    const long = link('long');
    const tops = new Set([...long.getClientRects()].map((rect) => Math.round(rect.top)));
    expect(linesOf(long)).toHaveLength(tops.size);
    expect(linesOf(link('overlap'))).toHaveLength(2);
  });

  test('a hover on the second line of a link whose lines overlap places the card at that line', async () => {
    mountLinks({ positioner: { side: 'top' } });
    await hoverLine('overlap', 1);
    const second = linesOf(link('overlap'))[1]!;
    await placedAt((box) => expectNear(box.bottom, second.top));
  });

  test('a hover on the first line of a link whose lines overlap places the card under that line', async () => {
    mountLinks();
    await hoverLine('overlap', 0);
    const first = linesOf(link('overlap'))[0]!;
    await placedAt((box) => expectNear(box.top, first.bottom));
  });

  test('the card is at the line that the pointer is on at the end of the delay', async () => {
    const delay = 150;
    mountLinks({ trigger: { delay }, positioner: { side: 'top' } });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      await hoverLine('overlap', 0);
      await hoverLine('overlap', 1);
      expect(positioner()).toBeNull();
      vi.advanceTimersByTime(delay);
    } finally {
      vi.useRealTimers();
    }
    const second = linesOf(link('overlap'))[1]!;
    await placedAt((box) => expectNear(box.bottom, second.top));
  });

  test('an open card keeps its line while the pointer moves to another line', async () => {
    mountLinks({ trigger: { delay: 0, closeDelay: 500 }, positioner: { side: 'top' } });
    await hoverLine('overlap', 1);
    const second = linesOf(link('overlap'))[1]!;
    await placedAt((box) => expectNear(box.bottom, second.top));
    await hoverLine('overlap', 0);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expectNear(positioner()!.getBoundingClientRect().bottom, second.top);
  });

  test('a hover on the second part of a link of two parts that do not overlap places the card at that part', async () => {
    mountLinks();
    await hoverLine('parts', 1);
    const second = linesOf(link('parts'))[1]!;
    await placedAt((box) => {
      expectNear(box.top, second.bottom);
      expectNear(center(box), center(second));
    });
  });

  test('a hover on a line of a link with elements and text of two directions places the card at that line', async () => {
    mountLinks();
    await hoverLine('long', 1);
    const second = linesOf(link('long'))[1]!;
    await placedAt((box) => expectNear(box.top, second.bottom));
  });

  test('a card that the focus opened is at the side rectangle: under the last line, at its middle, also after a hover on the first line', async () => {
    mountLinks({ trigger: { delay: 300 } });
    await hoverLine('overlap', 0);
    await userEvent.pointer({ coords: { x: 1, y: 1 } });
    // `focus()` after a key gives `:focus-visible`. After a mouse press, only Chromium takes Shift
    // as that key (test/measurements/preview-card.test.ts).
    await userEvent.keyboard('{Shift}');
    link('overlap').focus();
    const last = linesOf(link('overlap'))[1]!;
    await placedAt((box) => {
      expectNear(box.top, last.bottom);
      expectNear(center(box), center(last));
    });
  });

  test('a card that a hover moves to another link has the line of that link; a card that the parent moves or opens has no line', async () => {
    const root = reactive<Props>({ open: false, triggerId: null });
    root['onUpdate:open'] = (open: boolean) => (root.open = open);
    root['onUpdate:triggerId'] = (id: string | null) => (root.triggerId = id);
    mountLinks({ root });
    const overlap = linesOf(link('overlap'));
    const parts = linesOf(link('parts'));
    await hoverLine('parts', 0);
    await placedAt((box) => expectNear(center(box), center(parts[0]!)));
    await hoverLine('overlap', 0);
    await placedAt((box) => expectNear(box.top, overlap[0]!.bottom));
    root.triggerId = 'parts';
    // The side rectangle of a link of two parts: the bottom, the left and the right of the second.
    await placedAt((box) => {
      expectNear(box.top, parts[1]!.bottom);
      expectNear(center(box), center(parts[1]!));
    });
    root.open = false;
    await waitFor(() => expect(positioner()).toBe(null));
    Object.assign(root, { open: true, triggerId: 'overlap' });
    await placedAt((box) => expectNear(box.top, overlap[1]!.bottom));
  });

  test('a move to another link that a listener cancels keeps the line of the open card', async () => {
    mountLinks({
      root: {
        onOpenChange: (open: boolean, details: { trigger?: Element; cancel(): void }) => {
          if (open && details.trigger?.id === 'parts') details.cancel();
        },
      },
      trigger: { delay: 0, closeDelay: 5000 },
      positioner: { side: 'top' },
    });
    await hoverLine('overlap', 1);
    const second = linesOf(link('overlap'))[1]!;
    await placedAt((box) => expectNear(box.bottom, second.top));
    await hoverLine('parts', 0);
    window.dispatchEvent(new Event('resize'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(link('overlap')).toHaveAttribute('data-popup-open');
    expectNear(positioner()!.getBoundingClientRect().bottom, second.top);
  });

  test('a close that the parent refuses keeps the line', async () => {
    const root = reactive<Props>({ open: false });
    root['onUpdate:open'] = (open: boolean) => {
      if (open) root.open = true;
    };
    mountLinks({ root, positioner: { side: 'top' } });
    await hoverLine('overlap', 1);
    const second = linesOf(link('overlap'))[1]!;
    await placedAt((box) => expectNear(box.bottom, second.top));
    await userEvent.keyboard('{Escape}');
    window.dispatchEvent(new Event('resize'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expectNear(positioner()!.getBoundingClientRect().bottom, second.top);
  });

  test('one placement reads the lines of the link a few times: the line resets the anchor one time', async () => {
    mountLinks({ trigger: { delay: 0, closeDelay: 5000 }, positioner: { side: 'top' } });
    await hoverLine('overlap', 1);
    const second = linesOf(link('overlap'))[1]!;
    await placedAt((box) => expectNear(box.bottom, second.top));
    const overlap = link('overlap');
    let reads = 0;
    const read = overlap.getClientRects.bind(overlap);
    overlap.getClientRects = () => {
      reads += 1;
      return read();
    };
    onTestFinished(() => {
      delete (overlap as Partial<Element>).getClientRects;
    });
    window.dispatchEvent(new Event('resize'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(reads).toBeGreaterThan(0);
    expect(reads).toBeLessThan(10);
  });

  test('an `anchor` that is the link takes the line of the hover', async () => {
    const positionerProps = reactive<Props>({ side: 'top' });
    mountLinks({ positioner: positionerProps });
    positionerProps.anchor = link('overlap');
    await hoverLine('overlap', 1);
    const second = linesOf(link('overlap'))[1]!;
    await placedAt((box) => expectNear(box.bottom, second.top));
  });

  test('a hover on another line while a kept card leaves places the card at that line', async () => {
    const style = document.head.appendChild(document.createElement('style'));
    style.textContent =
      '[data-testid="popup"][hidden] { display: block; animation: line-leave 2s forwards } @keyframes line-leave { to { opacity: 0 } }';
    onTestFinished(() => style.remove());
    // The card is over the link, so that the card that leaves covers no line.
    mountLinks({
      trigger: { delay: 0, closeDelay: 0 },
      portal: { keepMounted: true },
      positioner: { side: 'top' },
    });
    const lines = linesOf(link('long'));
    await hoverLine('long', 0);
    await placedAt((box) => expectNear(box.bottom, lines[0]!.top));
    await userEvent.pointer({ coords: { x: 5, y: 5 } });
    const card = document.querySelector('[data-testid="popup"]')!;
    await waitFor(() => expect(card).toHaveAttribute('hidden'));
    expect(card.getAnimations().length).toBeGreaterThan(0);
    await hoverLine('long', 1);
    await waitFor(() => expect(link('long')).toHaveAttribute('data-popup-open'));
    await placedAt((box) => expectNear(box.bottom, lines[1]!.top));
  });

  test('the card stays at its line after a scroll of the page', async () => {
    document.documentElement.style.height = '4000px';
    onTestFinished(() => {
      document.documentElement.style.height = '';
      window.scrollTo(0, 0);
    });
    mountLinks({ trigger: { delay: 0, closeDelay: 5000 } });
    await hoverLine('overlap', 0);
    await placedAt((box) => expectNear(box.top, linesOf(link('overlap'))[0]!.bottom));
    window.scrollTo(0, 30);
    await placedAt((box) => expectNear(box.top, linesOf(link('overlap'))[0]!.bottom));
  });

  test('a virtual anchor with the link as its context element takes the line; a virtual anchor with no getClientRects() takes its rectangle', async () => {
    const positionerProps = reactive<Props>({ side: 'top' });
    mountLinks({ positioner: positionerProps });
    const overlap = link('overlap');
    const one = link('one');
    positionerProps.anchor = {
      contextElement: overlap,
      getBoundingClientRect: () => overlap.getBoundingClientRect(),
      getClientRects: () => overlap.getClientRects(),
    };
    await hoverLine('overlap', 1);
    const second = linesOf(overlap)[1]!;
    await placedAt((box) => expectNear(box.bottom, second.top));
    positionerProps.anchor = { getBoundingClientRect: () => one.getBoundingClientRect() };
    await placedAt((box) => expectNear(box.bottom, one.getBoundingClientRect().top));
  });

  test('with `positionMethod="fixed"`, a kept card with `disableAnchorTracking` takes the line of each new hover', async () => {
    mountLinks({
      trigger: { delay: 0, closeDelay: 0 },
      portal: { keepMounted: true },
      positioner: { positionMethod: 'fixed', disableAnchorTracking: true },
    });
    const overlap = linesOf(link('overlap'));
    await hoverLine('overlap', 1);
    await placedAt((box) => expectNear(box.top, overlap[1]!.bottom));
    await userEvent.pointer({ coords: { x: 1, y: 1 } });
    await waitFor(() => expect(link('overlap')).not.toHaveAttribute('data-popup-open'));
    await hoverLine('overlap', 0);
    await waitFor(() => expect(link('overlap')).toHaveAttribute('data-popup-open'));
    await placedAt((box) => expectNear(box.top, overlap[0]!.bottom));
  });
});
