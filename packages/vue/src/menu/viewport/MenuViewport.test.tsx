import { describe, expect, it } from 'vitest';
import * as Menu from '../index.parts';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  screen,
  takeReportedMessages,
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

  it('keeps the content of the previous trigger while the menu moves to another trigger', async () => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
    const handle = Menu.createHandle<number>();

    await render(
      <div>
        <style>{`
            [data-transitioning] [data-previous] {
              animation: slide-out 100s linear forwards;
            }
            [data-transitioning] [data-current] {
              animation: slide-in 100s linear forwards;
            }
            @keyframes slide-out {
              from { opacity: 1; }
              to { opacity: 0; }
            }
            @keyframes slide-in {
              from { opacity: 0; }
              to { opacity: 1; }
            }
          `}</style>
        <Menu.Trigger handle={handle} id="trigger-1" payload={1}>
          Trigger 1
        </Menu.Trigger>
        <Menu.Trigger handle={handle} id="trigger-2" payload={2}>
          Trigger 2
        </Menu.Trigger>
        <Menu.Root handle={handle}>
          {{
            default: ({ payload }: { payload: number | undefined }) => (
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Viewport data-testid="viewport">Content {payload}</Menu.Viewport>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            ),
          }}
        </Menu.Root>
      </div>,
    );

    handle.open('trigger-1');
    await waitFor(() => {
      expect(screen.getByText('Content 1')).toBeVisible();
    });
    const viewport = screen.getByTestId('viewport');
    expect(viewport).not.toHaveAttribute('data-transitioning');
    expect(document.querySelector('[data-previous]')).toBe(null);

    handle.open('trigger-2');

    let previousContainer: Element | null = null;
    await waitFor(() => {
      previousContainer = document.querySelector('[data-previous]');
      expect(previousContainer).not.toBe(null);
    });
    expect(viewport).toHaveAttribute('data-transitioning', '');
    expect(previousContainer).toHaveTextContent('Content 1');
    expect(document.querySelector('[data-current]')).toHaveTextContent('Content 2');

    // The previous container goes away when the animations end.
    for (const container of document.querySelectorAll('[data-previous], [data-current]')) {
      for (const animation of container.getAnimations()) {
        animation.finish();
      }
    }
    await waitFor(() => {
      expect(document.querySelector('[data-previous]')).toBe(null);
    });
    expect(viewport).not.toHaveAttribute('data-transitioning');
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
