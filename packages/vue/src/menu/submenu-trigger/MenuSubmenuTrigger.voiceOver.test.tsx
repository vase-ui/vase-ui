import { describe, expect, it, vi } from 'vitest';
import * as Menu from '../index.parts';
import { createRenderer, fireEvent, screen } from '#test-utils';
import { createMenuStoreProbe } from '../../../test/fixtures/MenuStoreProbe';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';

// Kept in a separate file so the module mock doesn't leak into `MenuSubmenuTrigger.test.tsx`.
vi.mock('../../common/platform', async () => {
  const actual =
    await vi.importActual<typeof import('../../common/platform')>('../../common/platform');

  return {
    ...actual,
    platform: {
      ...actual.platform,
      screenReader: { ...actual.platform.screenReader, voiceOver: true },
    },
  };
});

describe('<Menu.SubmenuTrigger /> with VoiceOver', () => {
  const { render } = createRenderer();

  function renderSubmenu(probe: ReturnType<typeof createMenuStoreProbe>) {
    return render(
      <Menu.Root open>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.SubmenuRoot>
                <probe.Probe />
                <Menu.SubmenuTrigger delay={0}>More</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup data-testid="submenu">
                      <Menu.Item>Alpha</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );
  }

  it('omits the expanded state while a submenu that list navigation opened is open', async () => {
    const probe = createMenuStoreProbe();
    await renderSubmenu(probe);
    const submenuTrigger = screen.getByRole('menuitem', { name: 'More' });

    probe.store.setOpen(
      true,
      createChangeEventDetails(
        REASONS.listNavigation,
        new KeyboardEvent('keydown', { key: 'ArrowRight' }),
        submenuTrigger,
      ),
    );

    await screen.findByTestId('submenu');
    expect(submenuTrigger).not.toHaveAttribute('aria-expanded');
    expect(submenuTrigger).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('keeps the expanded state when a hover opened the submenu', async () => {
    await renderSubmenu(createMenuStoreProbe());
    const submenuTrigger = screen.getByRole('menuitem', { name: 'More' });

    await fireEvent.mouseEnter(submenuTrigger);
    await fireEvent.mouseMove(submenuTrigger);

    await screen.findByTestId('submenu');
    expect(submenuTrigger).toHaveAttribute('aria-expanded', 'true');
  });
});
