import { expect, describe, it, onTestFinished } from 'vitest';
import { shallowRef } from 'vue';
import * as PreviewCard from '../index.parts';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';
import PreviewCardPopupReplace from './PreviewCardPopupReplace.test.vue';

describe('<PreviewCard.Popup />', () => {
  const { render } = createRenderer();

  describeConformance(<PreviewCard.Popup />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(
        <PreviewCard.Root open>
          <PreviewCard.Portal>
            <PreviewCard.Positioner>{node}</PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));

  it('should render the children', async () => {
    await render(
      <PreviewCard.Root open>
        <PreviewCard.Portal>
          <PreviewCard.Positioner>
            <PreviewCard.Popup>Content</PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>,
    );
    await flushMicrotasks();

    expect(screen.getByText('Content')).not.toBe(null);
  });

  it('has no transition while it starts', async () => {
    // The start lasts one frame, so an observer records the popup when the portal adds it.
    const starts: Array<{ isStarting: boolean; transition: string }> = [];
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
      <PreviewCard.Root open={open.value}>
        <PreviewCard.Portal>
          <PreviewCard.Positioner>
            <PreviewCard.Popup data-testid="popup">Content</PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
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
      <PreviewCard.Root defaultOpen>
        <PreviewCard.Portal>
          <PreviewCard.Positioner>
            <PreviewCardPopupReplace swapped={swapped.value} />
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
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

  it('throws a descriptive error when rendered outside <PreviewCard.Positioner>', async () => {
    await expect(
      render(
        <PreviewCard.Root open>
          <PreviewCard.Portal>
            <PreviewCard.Popup />
          </PreviewCard.Portal>
        </PreviewCard.Root>,
      ),
    ).rejects.toThrow(
      'Vase UI: A popup or an arrow of PreviewCard must be inside <PreviewCard.Positioner>.',
    );
    // The portal renders its content in an update after the mount, so Vue also warns about it.
    expect(takeReportedMessages()).toHaveLength(2);
  });

  // In Vue 3.5.12, a `setup` that throws leaves the current instance set, and a later slot then
  // gives a warning. The case that renders no slot thus comes last.
  it('throws a descriptive error when rendered outside <PreviewCard.Root>', async () => {
    await expect(render(<PreviewCard.Popup />)).rejects.toThrow(
      'Vase UI: A part of PreviewCard must be inside <PreviewCard.Root>.',
    );
    expect(takeReportedMessages()).toHaveLength(1);
  });
});
