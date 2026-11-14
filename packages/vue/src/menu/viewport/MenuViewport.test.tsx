import { describe, expect, it } from 'vitest';
import * as Menu from '../index.parts';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  screen,
  takeReportedMessages,
  viewportConformanceTests,
  waitFor,
} from '#test-utils';

describe('<Menu.Viewport />', () => {
  const { render } = createRenderer();

  describeConformance(<Menu.Viewport />, () => ({
    refInstanceof: window.HTMLDivElement,
    childrenSelector: '[data-current]',
    async render(node) {
      const result = await render(
        <Menu.Root open>
          <Menu.Trigger>Trigger</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>{node}</Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));

  viewportConformanceTests({
    render,
    openOn: 'click',
    createComponent: ({ root, triggers, portal, positioner, popup, viewport, renderContent }) => (
      <Menu.Root {...root}>
        {{
          default: ({ payload }: { payload: unknown }) => [
            ...triggers.map(({ key, children, ...triggerProps }, index) => (
              <Menu.Trigger key={key ?? index} {...triggerProps}>
                {children}
              </Menu.Trigger>
            )),
            <Menu.Portal {...portal}>
              <Menu.Positioner {...positioner}>
                <Menu.Popup {...popup}>
                  <Menu.Viewport {...viewport}>{renderContent(payload)}</Menu.Viewport>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>,
          ],
        }}
      </Menu.Root>
    ),
  });

  async function renderViewport() {
    const result = await render(
      <Menu.Root defaultOpen>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal keepMounted>
          <Menu.Positioner>
            <Menu.Popup data-testid="popup">
              <Menu.Viewport data-testid="viewport">
                <Menu.Item>Item</Menu.Item>
              </Menu.Viewport>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );
    const viewport = await screen.findByTestId('viewport');
    const popup = screen.getByTestId('popup');
    // The popup takes the focus one frame after the mount.
    await waitFor(() => {
      expect(popup).toHaveFocus();
    });
    expect(viewport).not.toHaveAttribute('data-instant');
    return { ...result, viewport, popup };
  }

  it.each([
    { name: 'Escape', key: '{Escape}', instant: 'dismiss' },
    { name: 'Enter on an item', key: '{Enter}', instant: 'click' },
  ])('has `data-instant` $instant after $name', async ({ key, instant }) => {
    const { user, viewport, popup } = await renderViewport();
    screen.getByRole('menuitem', { name: 'Item' }).focus();

    await user.keyboard(key);
    await waitFor(() => {
      expect(popup).toHaveAttribute('data-closed');
    });
    expect(viewport).toHaveAttribute('data-instant', instant);
  });

  // A case that throws in `setup` is the last of its file.
  it('throws a descriptive error when rendered outside <Menu.Positioner>', async () => {
    await expect(
      render(
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Viewport />
          </Menu.Portal>
        </Menu.Root>,
      ),
    ).rejects.toThrow(
      'Vase UI: <Menu.Popup>, <Menu.Arrow> and <Menu.Viewport> must be inside <Menu.Positioner>.',
    );
    // The portal renders its content in an update after the mount, so Vue also warns about it.
    expect(takeReportedMessages()).toHaveLength(2);
  });
});
