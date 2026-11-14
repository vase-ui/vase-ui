import { expect, describe, it, onTestFinished } from 'vitest';
import { shallowRef } from 'vue';
import * as Tooltip from '../index.parts';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
  takeReportedMessages,
  wait,
  waitFor,
  waitForPositioned,
} from '#test-utils';
import TooltipPopupReplace from './TooltipPopupReplace.test.vue';

describe('<Tooltip.Popup />', () => {
  const { render } = createRenderer();

  describeConformance(<Tooltip.Popup />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(
        <Tooltip.Root open>
          <Tooltip.Portal>
            <Tooltip.Positioner>{node}</Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));

  it('should render the children', async () => {
    await render(
      <Tooltip.Root open>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup>Content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );
    await flushMicrotasks();

    expect(screen.getByText('Content')).not.toBe(null);
  });

  it('has no transition while it starts', async () => {
    // The start lasts one frame, so an observer records the popup when the portal adds it.
    const starts: { isStarting: boolean; transition: string }[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          const popup = (node as Element).querySelector?.<HTMLElement>('[data-testid="popup"]');
          if (popup) {
            starts.push({
              isStarting: popup.hasAttribute('data-starting-style'),
              transition: popup.style.transition,
            });
          }
        }
      }
    });
    observer.observe(document.body, { childList: true });
    onTestFinished(() => observer.disconnect());

    const open = shallowRef(false);
    await render(() => (
      <Tooltip.Root open={open.value}>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    open.value = true;
    const popup = await screen.findByTestId('popup');
    await waitFor(() => {
      expect(popup).toHaveAttribute('data-open');
    });
    await waitFor(() => {
      expect(popup.style.transition).toBe('');
    });

    expect(starts).toEqual([{ isStarting: true, transition: 'none' }]);
  });

  it('keeps the element of a new popup that replaces the old popup, so a close completes', async () => {
    const swapped = shallowRef(false);
    const { user } = await render(() => (
      <Tooltip.Root defaultOpen>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <TooltipPopupReplace swapped={swapped.value} />
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));
    await screen.findByTestId('old');

    swapped.value = true;
    await flushMicrotasks();
    expect(screen.queryByTestId('old')).toBe(null);

    await user.keyboard('[Escape]');
    await waitFor(() => {
      expect(screen.queryByTestId('new')).toBe(null);
    });
  });

  it('stays open while the pointer is on it, and closes when the pointer leaves it', async () => {
    await render(
      <div style={{ paddingTop: '100px', paddingLeft: '100px' }}>
        <Tooltip.Root>
          <Tooltip.Trigger delay={0} style={{ width: '120px', height: '40px' }}>
            Trigger
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner data-testid="positioner" side="bottom">
              <Tooltip.Popup data-testid="popup" style={{ width: '120px', height: '40px' }}>
                Content
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </div>,
    );
    const trigger = screen.getByRole('button', { name: 'Trigger' });
    await fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
    await fireEvent.mouseEnter(trigger);
    await fireEvent.mouseMove(trigger);
    const popup = await screen.findByTestId('popup');
    const positioner = screen.getByTestId('positioner');
    await waitForPositioned(positioner);

    const rect = popup.getBoundingClientRect();
    const inside = { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
    await fireEvent.mouseLeave(trigger, inside);
    await fireEvent.mouseEnter(positioner, inside);
    await fireEvent.mouseMove(popup, inside);
    // The safe polygon closes a popup that the pointer did not reach 40 ms after the leave.
    await wait(100);

    expect(popup).toHaveAttribute('data-open');

    await fireEvent.mouseLeave(positioner, {
      relatedTarget: document.body,
      clientX: rect.left + rect.width / 2,
      clientY: rect.bottom + 100,
    });
    await waitFor(() => {
      expect(screen.queryByTestId('popup')).toBe(null);
    });
  });

  it('throws a descriptive error when rendered outside <Tooltip.Positioner>', async () => {
    await expect(
      render(
        <Tooltip.Root open>
          <Tooltip.Portal>
            <Tooltip.Popup />
          </Tooltip.Portal>
        </Tooltip.Root>,
      ),
    ).rejects.toThrow(
      'Vase UI: A popup or an arrow of Tooltip must be inside <Tooltip.Positioner>.',
    );
    // The portal renders its content in an update after the mount, so Vue also warns about it.
    expect(takeReportedMessages()).toHaveLength(2);
  });
});
