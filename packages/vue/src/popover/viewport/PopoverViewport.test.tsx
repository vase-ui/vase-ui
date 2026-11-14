import { describe, expect, it } from 'vitest';
import * as Popover from '../index.parts';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  screen,
  takeReportedMessages,
  viewportConformanceTests,
  waitFor,
} from '#test-utils';

describe('<Popover.Viewport />', () => {
  const { render } = createRenderer();

  describeConformance(<Popover.Viewport />, () => ({
    refInstanceof: window.HTMLDivElement,
    childrenSelector: '[data-current]',
    async render(node) {
      const result = await render(
        <Popover.Root open>
          <Popover.Trigger>Trigger</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>{node}</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));

  viewportConformanceTests({
    render,
    openOn: 'click',
    createComponent: ({ root, triggers, portal, positioner, popup, viewport, renderContent }) => (
      <Popover.Root {...root}>
        {{
          default: ({ payload }: { payload: unknown }) => [
            ...triggers.map(({ key, children, ...triggerProps }, index) => (
              <Popover.Trigger key={key ?? index} {...triggerProps}>
                {children}
              </Popover.Trigger>
            )),
            <Popover.Portal {...portal}>
              <Popover.Positioner {...positioner}>
                <Popover.Popup {...popup}>
                  <Popover.Viewport {...viewport}>{renderContent(payload)}</Popover.Viewport>
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>,
          ],
        }}
      </Popover.Root>
    ),
  });

  it('has `data-instant` with the instant type of the popover', async () => {
    const { user } = await render(
      <Popover.Root>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Portal keepMounted>
          <Popover.Positioner>
            <Popover.Popup data-testid="popup">
              <Popover.Viewport data-testid="viewport">Content</Popover.Viewport>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    );
    const viewport = await screen.findByTestId('viewport');
    const popup = screen.getByTestId('popup');
    expect(viewport).not.toHaveAttribute('data-instant');

    screen.getByRole('button', { name: 'Open' }).focus();
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(popup).toHaveAttribute('data-open');
    });
    expect(viewport).toHaveAttribute('data-instant', 'click');

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(popup).toHaveAttribute('data-closed');
    });
    expect(viewport).toHaveAttribute('data-instant', 'dismiss');
  });

  it('throws a descriptive error when rendered outside <Popover.Positioner>', async () => {
    await expect(
      render(
        <Popover.Root open>
          <Popover.Portal>
            <Popover.Viewport />
          </Popover.Portal>
        </Popover.Root>,
      ),
    ).rejects.toThrow(
      'Vase UI: A popup, an arrow or a viewport of Popover must be inside <Popover.Positioner>.',
    );
    // The portal renders its content in an update after the mount, so Vue also warns about it.
    expect(takeReportedMessages()).toHaveLength(2);
  });
});
