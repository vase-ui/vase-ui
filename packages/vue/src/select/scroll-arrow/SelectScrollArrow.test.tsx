import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Select } from '@vase-ui/vue/select';
import { actOnElement } from '../../../test/fixtures/actOnElement';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  pressWithTouch,
  screen,
  waitFor,
} from '#test-utils';

const DEFAULT_ITEM_OFFSETS = [0, 40, 80, 120, 160, 200, 240, 280, 320, 360];

/**
 * Installs a mutable `scrollTop` plus fixed `scrollHeight`/`clientHeight` on a scroller so the
 * hover auto-scroll can be exercised in every engine (Chromium won't lay out enough content to
 * overflow at these sizes).
 */
function stubScroller(
  node: HTMLElement,
  geometry: { scrollHeight: number; clientHeight: number },
  readScrollTop: () => number,
  onScrollTopChange: (value: number) => void,
) {
  Object.defineProperty(node, 'scrollTop', {
    configurable: true,
    get: readScrollTop,
    set: onScrollTopChange,
  });
  Object.defineProperty(node, 'scrollHeight', {
    value: geometry.scrollHeight,
    configurable: true,
  });
  Object.defineProperty(node, 'clientHeight', {
    value: geometry.clientHeight,
    configurable: true,
  });
}

function stubItem(node: HTMLElement, offsetTop: number, offsetHeight: number) {
  Object.defineProperty(node, 'offsetTop', { value: offsetTop, configurable: true });
  Object.defineProperty(node, 'offsetHeight', { value: offsetHeight, configurable: true });
}

/**
 * Collapses the arrows so their own height doesn't shift the visible edge the scroll target is
 * measured against.
 */
function collapseArrows() {
  const downArrow = screen.getByTestId('down');
  const upArrow = screen.getByTestId('up');
  Object.defineProperty(downArrow, 'offsetHeight', { value: 0, configurable: true });
  Object.defineProperty(upArrow, 'offsetHeight', { value: 0, configurable: true });
  return { downArrow, upArrow };
}

function hoverArrow(arrow: HTMLElement, direction: 'up' | 'down') {
  return fireEvent.mouseMove(arrow, { movementX: 0, movementY: direction === 'down' ? 1 : -1 });
}

async function advanceTimers(ms: number) {
  vi.advanceTimersByTime(ms);
  await flushMicrotasks();
}

describe('<Select.ScrollArrow />', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Renders a scrollable select whose list geometry is fully stubbed, and returns a live view of
   * the scroll offset the component writes back.
   */
  async function renderScrollableSelect(options: {
    initialScrollTop: number;
    scrollHeight?: number;
    clientHeight?: number;
    itemOffsets?: number[];
    itemHeight?: number;
  }) {
    const {
      initialScrollTop,
      scrollHeight = 400,
      clientHeight = 200,
      itemOffsets = DEFAULT_ITEM_OFFSETS,
      itemHeight = 40,
    } = options;

    let scrollTop = initialScrollTop;
    let scrollWrites = 0;

    await render(
      <Select.Root open>
        <Select.Trigger>Open</Select.Trigger>
        <Select.Portal>
          <Select.Positioner alignItemWithTrigger={false}>
            <Select.Popup>
              <Select.ScrollUpArrow keepMounted data-testid="up" />
              <Select.List
                v-slots={actOnElement(
                  'div',
                  (node) =>
                    stubScroller(
                      node,
                      { scrollHeight, clientHeight },
                      () => scrollTop,
                      (value) => {
                        scrollWrites += 1;
                        scrollTop = value;
                      },
                    ),
                  () =>
                    itemOffsets.map((offsetTop, index) => (
                      <Select.Item
                        key={index}
                        value={`item-${index}`}
                        v-slots={actOnElement(
                          'div',
                          (node) => stubItem(node, offsetTop, itemHeight),
                          () => `Item ${index}`,
                        )}
                      />
                    )),
                )}
              />
              <Select.ScrollDownArrow keepMounted data-testid="down" />
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );
    await flushMicrotasks();

    return {
      ...collapseArrows(),
      getScrollTop: () => scrollTop,
      getScrollWrites: () => scrollWrites,
    };
  }

  /**
   * Renders a select without `Select.List`, so the popup itself is the stubbed scroller.
   */
  async function renderPopupScroller(options: { initialScrollTop: number; withItems: boolean }) {
    const { initialScrollTop, withItems } = options;
    let scrollTop = initialScrollTop;

    await render(
      <Select.Root open>
        <Select.Trigger>Open</Select.Trigger>
        <Select.Portal>
          <Select.Positioner alignItemWithTrigger={false}>
            <Select.Popup
              v-slots={actOnElement(
                'div',
                (node) =>
                  stubScroller(
                    node,
                    { scrollHeight: 400, clientHeight: 200 },
                    () => scrollTop,
                    (value) => {
                      scrollTop = value;
                    },
                  ),
                () => [
                  <Select.ScrollUpArrow keepMounted data-testid="up" />,
                  withItems &&
                    DEFAULT_ITEM_OFFSETS.map((offsetTop, index) => (
                      <Select.Item
                        key={index}
                        value={`item-${index}`}
                        v-slots={actOnElement(
                          'div',
                          (node) => stubItem(node, offsetTop, 40),
                          () => `Item ${index}`,
                        )}
                      />
                    )),
                  <Select.ScrollDownArrow keepMounted data-testid="down" />,
                ],
              )}
            />
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );
    await flushMicrotasks();

    return { ...collapseArrows(), getScrollTop: () => scrollTop };
  }

  // All of these land on the target computed by the shared `getTargetScrollTop`.
  it.each([
    {
      name: 'down: snaps to a fractional bottom',
      direction: 'down' as const,
      initialScrollTop: 19.5,
      scrollHeight: 100.5,
      clientHeight: 60,
      itemOffsets: [0, 40, 80],
      itemHeight: 20,
      expected: 40.5,
    },
    {
      name: 'down: passes a fractional item bottom',
      direction: 'down' as const,
      initialScrollTop: 71.81818389892578,
      scrollHeight: 598,
      clientHeight: 440,
      itemOffsets: [32, 64, 96, 128, 160, 192, 224, 256, 336, 368, 400, 432, 448, 480, 512, 544],
      itemHeight: 32,
      expected: 104,
    },
    {
      // 200px of trailing content (padding, a footer) below the last item.
      name: 'down: scrolls past trailing content',
      direction: 'down' as const,
      initialScrollTop: 390,
      scrollHeight: 600,
      clientHeight: 200,
      itemOffsets: DEFAULT_ITEM_OFFSETS,
      itemHeight: 40,
      expected: 400,
    },
    {
      name: 'up: passes a fractional item top',
      direction: 'up' as const,
      initialScrollTop: 72.18181610107422,
      scrollHeight: 598,
      clientHeight: 440,
      itemOffsets: [32, 71.5, 110, 142],
      itemHeight: 32,
      expected: 32,
    },
    {
      // Every item sits below the current viewport top, as it would with a tall group label or
      // padding above the first item.
      name: 'up: scrolls to the top, no item above',
      direction: 'up' as const,
      initialScrollTop: 100,
      scrollHeight: 600,
      clientHeight: 200,
      itemOffsets: [300, 340, 380],
      itemHeight: 40,
      expected: 0,
    },
  ])('$name', async ({ direction, expected, ...geometry }) => {
    const { downArrow, upArrow, getScrollTop } = await renderScrollableSelect(geometry);

    await hoverArrow(direction === 'down' ? downArrow : upArrow, direction);
    await advanceTimers(40);

    expect(getScrollTop()).toBe(expected);
  });

  it('does not start auto-scrolling for a mouse move that did not move the pointer', async () => {
    const { downArrow, getScrollTop } = await renderScrollableSelect({ initialScrollTop: 0 });

    // Browsers dispatch a zero-movement `mousemove` when content scrolls beneath a stationary
    // cursor; that must not kick off the hover scroll.
    await fireEvent.mouseMove(downArrow, { movementX: 0, movementY: 0 });
    await advanceTimers(400);

    expect(getScrollTop()).toBe(0);
  });

  it('does not let continuous pointer movement postpone the scheduled scroll', async () => {
    const { downArrow, getScrollTop } = await renderScrollableSelect({ initialScrollTop: 0 });

    await fireEvent.mouseMove(downArrow, { movementX: 0, movementY: 1 });
    await advanceTimers(30);

    // A second move arrives before the first scroll fires. Restarting the timer here would
    // mean a user who keeps jiggling the pointer never scrolls at all.
    await fireEvent.mouseMove(downArrow, { movementX: 1, movementY: 1 });
    await advanceTimers(15);

    expect(getScrollTop()).toBe(40);
  });

  it('stops auto-scrolling once the pointer leaves the arrow', async () => {
    const { downArrow, getScrollTop } = await renderScrollableSelect({ initialScrollTop: 0 });

    await hoverArrow(downArrow, 'down');
    await advanceTimers(40);

    expect(getScrollTop()).toBe(40);

    await fireEvent.mouseLeave(downArrow);
    await advanceTimers(400);

    expect(getScrollTop()).toBe(40);
  });

  it('snaps a sub-pixel offset to the exact top edge and then stops scrolling', async () => {
    // Within `SCROLL_EDGE_TOLERANCE_PX` of the top, so the offset normalizes to exactly 0.
    const { upArrow, getScrollTop, getScrollWrites } = await renderScrollableSelect({
      initialScrollTop: 0.4,
    });

    await hoverArrow(upArrow, 'up');
    await advanceTimers(40);

    expect(getScrollTop()).toBe(0);

    const writesAtEdge = getScrollWrites();

    // Reaching the edge must cancel the loop rather than spin on no-op scroll writes every
    // 40ms for as long as the pointer rests on the arrow.
    await advanceTimers(400);

    expect(getScrollTop()).toBe(0);
    expect(getScrollWrites()).toBe(writesAtEdge);
  });

  it('scrolls the popup itself when no Select.List is rendered', async () => {
    const { downArrow, getScrollTop } = await renderPopupScroller({
      initialScrollTop: 0,
      withItems: true,
    });

    await hoverArrow(downArrow, 'down');
    await advanceTimers(40);

    expect(getScrollTop()).toBe(40);
  });

  it.each(['up' as const, 'down' as const])(
    'reflects scrollability on the %s arrow when the popup has no registered items',
    async (direction) => {
      const { downArrow, upArrow } = await renderPopupScroller({
        initialScrollTop: 100,
        withItems: false,
      });
      const arrow = direction === 'down' ? downArrow : upArrow;

      await hoverArrow(arrow, direction);
      await advanceTimers(40);

      // Mid-scroller with nothing to step through: the arrow still reports that more content
      // lies beyond it rather than silently disappearing.
      expect(arrow).toHaveAttribute('data-visible');
    },
  );

  it('hides the arrow when an item-less popup is already scrolled to its edge', async () => {
    const { downArrow } = await renderPopupScroller({ initialScrollTop: 200, withItems: false });

    await hoverArrow(downArrow, 'down');
    await advanceTimers(40);

    expect(downArrow).not.toHaveAttribute('data-visible');
  });

  it('ignores pointer interaction when the arrow has no scrollable popup', async () => {
    await render(
      <Select.Root open>
        <Select.Trigger>Open</Select.Trigger>
        <Select.Portal>
          <Select.Positioner alignItemWithTrigger={false}>
            <Select.ScrollDownArrow keepMounted data-testid="down" />
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );
    await flushMicrotasks();

    await hoverArrow(screen.getByTestId('down'), 'down');

    // Without a popup there is nothing to scroll; the loop must bail out instead of
    // dereferencing a missing scroller.
    expect(() => vi.advanceTimersByTime(400)).not.toThrow();
  });
});

describe('<Select.ScrollArrow /> and the pointer that opens the popup', () => {
  const { render } = createRenderer();

  async function renderClosedSelect() {
    const { user } = await render(
      <Select.Root>
        <Select.Trigger data-testid="trigger">Open</Select.Trigger>
        <Select.Portal>
          <Select.Positioner alignItemWithTrigger={false}>
            <Select.Popup>
              <Select.ScrollUpArrow keepMounted data-testid="up" />
              <Select.List
                v-slots={actOnElement(
                  'div',
                  (node) =>
                    stubScroller(
                      node,
                      { scrollHeight: 400, clientHeight: 200 },
                      () => 100,
                      () => {},
                    ),
                  () => (
                    <Select.Item value="a">a</Select.Item>
                  ),
                )}
              />
              <Select.ScrollDownArrow keepMounted data-testid="down" />
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );
    return { user, trigger: screen.getByTestId('trigger') };
  }

  it('shows both arrows of a list that is scrolled to the middle, after a press of the mouse', async () => {
    const { user, trigger } = await renderClosedSelect();

    await user.click(trigger);
    await flushMicrotasks();

    await waitFor(() => {
      expect(screen.getByTestId('up')).toHaveAttribute('data-visible');
    });
    expect(screen.getByTestId('down')).toHaveAttribute('data-visible');
  });

  it('shows no arrow after a touch, because the arrows work on hover', async () => {
    const { trigger } = await renderClosedSelect();

    await pressWithTouch(trigger);
    const list = await screen.findByRole('listbox');
    await flushMicrotasks();
    await fireEvent.scroll(list);

    expect(screen.getByTestId('up')).not.toHaveAttribute('data-visible');
    expect(screen.getByTestId('down')).not.toHaveAttribute('data-visible');
  });
});
