import { expect, describe, it, onTestFinished } from 'vitest';
import { shallowRef } from 'vue';
import * as Tooltip from '../index.parts';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  screen,
  takeReportedMessages,
  waitFor,
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
