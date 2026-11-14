import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { Menubar } from '@vase-ui/vue/menubar';
import * as Menu from '../menu/index.parts';
import { createRenderer, screen, waitFor } from '#test-utils';

// Kept in a separate file so the module mock doesn't leak into `Menubar.test.tsx`. Each engine runs
// the branches of Safari on a Mac.
vi.mock('../common/platform', async () => {
  const actual = await vi.importActual<typeof import('../common/platform')>('../common/platform');

  return {
    ...actual,
    platform: {
      ...actual.platform,
      os: { ...actual.platform.os, mac: true },
      engine: { ...actual.platform.engine, webkit: true },
    },
  };
});

describe('<Menubar /> in Safari on a Mac', () => {
  const { render } = createRenderer();

  it('VUE-67: opens the next menu on hover after a press opened the first menu', async () => {
    await render(
      <Menubar>
        <Menu.Root>
          <Menu.Trigger data-testid="file-trigger">File</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner data-testid="file-menu">
              <Menu.Popup>
                <Menu.Item>Open</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
        <Menu.Root>
          <Menu.Trigger data-testid="edit-trigger">Edit</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner data-testid="edit-menu">
              <Menu.Popup>
                <Menu.Item>Copy</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menubar>,
    );

    await userEvent.click(screen.getByTestId('file-trigger'));
    const fileMenu = await screen.findByTestId('file-menu');
    await waitFor(() => {
      expect(fileMenu.contains(document.activeElement)).toBe(true);
    });

    // The first menu closes and gives the focus back to its trigger. That focus must not open the
    // first menu again, because the last input was a pointer press.
    await userEvent.hover(screen.getByTestId('edit-trigger'));
    const editMenu = await screen.findByTestId('edit-menu');
    await waitFor(() => {
      expect(editMenu.contains(document.activeElement)).toBe(true);
    });

    expect(screen.queryByTestId('file-menu')).toBe(null);
    expect(editMenu).toBeInTheDocument();
  });
});
