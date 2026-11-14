import { expect, describe, it } from 'vitest';
import * as PreviewCard from '../index.parts';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
  takeReportedMessages,
  viewportConformanceTests,
  waitFor,
} from '#test-utils';

describe('<PreviewCard.Viewport />', () => {
  const { render } = createRenderer();

  describeConformance(<PreviewCard.Viewport />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(
        <PreviewCard.Root open>
          <PreviewCard.Trigger>Trigger</PreviewCard.Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner>
              <PreviewCard.Popup>{node}</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));

  viewportConformanceTests({
    render,
    openOn: 'focus',
    createComponent: ({ root, triggers, portal, positioner, popup, viewport, renderContent }) => (
      <PreviewCard.Root {...root}>
        {{
          default: ({ payload }: { payload: unknown }) => [
            ...triggers.map(({ key, children, ...triggerProps }, index) => (
              <PreviewCard.Trigger key={key ?? index} href="#" delay={0} {...triggerProps}>
                {children}
              </PreviewCard.Trigger>
            )),
            <PreviewCard.Portal {...portal}>
              <PreviewCard.Positioner {...positioner}>
                <PreviewCard.Popup {...popup}>
                  <PreviewCard.Viewport {...viewport}>
                    {renderContent(payload)}
                  </PreviewCard.Viewport>
                </PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>,
          ],
        }}
      </PreviewCard.Root>
    ),
  });

  it('has `data-instant` with the instant type of the card', async () => {
    await render(
      <PreviewCard.Root>
        <PreviewCard.Trigger href="#" delay={0}>
          Link
        </PreviewCard.Trigger>
        <PreviewCard.Portal keepMounted>
          <PreviewCard.Positioner>
            <PreviewCard.Popup data-testid="popup">
              <PreviewCard.Viewport data-testid="viewport">Content</PreviewCard.Viewport>
            </PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>,
    );
    const viewport = await screen.findByTestId('viewport');
    const popup = screen.getByTestId('popup');
    const trigger = screen.getByRole('link', { name: 'Link' });
    expect(viewport).not.toHaveAttribute('data-instant');

    trigger.focus();
    await flushMicrotasks();
    await waitFor(() => {
      expect(popup).toHaveAttribute('data-open');
    });
    expect(viewport).toHaveAttribute('data-instant', 'focus');

    await fireEvent.keyDown(trigger, { key: 'Escape' });
    await waitFor(() => {
      expect(popup).toHaveAttribute('data-closed');
    });
    expect(viewport).toHaveAttribute('data-instant', 'dismiss');
  });

  it('throws a descriptive error when rendered outside <PreviewCard.Positioner>', async () => {
    await expect(
      render(
        <PreviewCard.Root open>
          <PreviewCard.Portal>
            <PreviewCard.Viewport />
          </PreviewCard.Portal>
        </PreviewCard.Root>,
      ),
    ).rejects.toThrow(
      'Vase UI: A popup, an arrow or a viewport of PreviewCard must be inside <PreviewCard.Positioner>.',
    );
    // The portal renders its content in an update after the mount, so Vue also warns about it.
    expect(takeReportedMessages()).toHaveLength(2);
  });
});
