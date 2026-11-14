import { describe, expect, it } from 'vitest';
import * as Menu from '../index.parts';
import {
  createRenderer,
  isJSDOM,
  pressWithScreenReader,
  screen,
  waitFor,
  waitSingleFrame,
} from '#test-utils';

async function waitForFrames(count = 2) {
  for (let i = 0; i < count; i += 1) {
    await waitSingleFrame();
  }
}

// `isVirtualPointerEvent` returns `false` under jsdom, so the virtual press cannot be detected there.
describe.skipIf(isJSDOM)('<Menu.SubmenuTrigger /> with a screen reader press', () => {
  const { render } = createRenderer();

  it('opens a filterable submenu from a filterable parent and focuses its input', async () => {
    await render(
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Open menu</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Item>Share</Menu.Item>
                  <Menu.FilterProvider>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger data-testid="submenu-trigger">More</Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner>
                          <Menu.Popup data-testid="submenu">
                            <Menu.Input aria-label="Filter more" />
                            <Menu.List>
                              <Menu.Item>Alpha</Menu.Item>
                            </Menu.List>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.FilterProvider>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('searchbox', { name: 'Filter actions' })).toHaveFocus();
    });
    const submenuTrigger = screen.getByTestId('submenu-trigger');

    await pressWithScreenReader(submenuTrigger);

    expect(await screen.findByTestId('submenu')).not.toBe(null);
    await waitFor(() => {
      expect(screen.getByRole('searchbox', { name: 'Filter more' })).toHaveFocus();
    });
  });

  it('keeps focus in a kept-mounted filterable submenu opened by a screen reader press', async () => {
    await render(
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Open menu</Menu.Trigger>
          <Menu.Portal keepMounted>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Item>Share</Menu.Item>
                  <Menu.FilterProvider>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger data-testid="submenu-trigger">More</Menu.SubmenuTrigger>
                      <Menu.Portal keepMounted>
                        <Menu.Positioner>
                          <Menu.Popup data-testid="submenu">
                            <Menu.Input aria-label="Filter more" />
                            <Menu.List>
                              <Menu.Item>Alpha</Menu.Item>
                            </Menu.List>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.FilterProvider>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('searchbox', { name: 'Filter actions' })).toHaveFocus();
    });

    await pressWithScreenReader(screen.getByTestId('submenu-trigger'));

    await waitFor(() => {
      expect(screen.getByRole('searchbox', { name: 'Filter more' })).toHaveFocus();
    });
    // The stale return-focus cleanup must not pull focus back to the parent input.
    await waitForFrames();
    expect(screen.getByRole('searchbox', { name: 'Filter more' })).toHaveFocus();
  });
});
