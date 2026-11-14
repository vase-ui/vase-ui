import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import * as Menu from '../index.parts';
import { createRenderer, flushMicrotasks, isJSDOM, screen, waitFor } from '#test-utils';
import { createMenuStoreProbe } from '../../../test/fixtures/MenuStoreProbe';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';

/**
 * Records whether an element ever matches `selector`. The attributes that the cases look for can
 * last one frame, so an observer records them.
 */
function trackSelector(selector: string) {
  let seen = false;
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes' && (record.target as Element).matches(selector)) {
        seen = true;
      }
      for (const node of record.addedNodes) {
        if (node instanceof Element && (node.matches(selector) || node.querySelector(selector))) {
          seen = true;
        }
      }
    }
  });
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['data-starting-style', 'data-instant'],
    childList: true,
    subtree: true,
  });
  onTestFinished(() => observer.disconnect());
  return { seen: () => seen };
}

function trackStartingStyle(testId: string) {
  return trackSelector(`[data-testid="${testId}"][data-starting-style]`);
}

describe.skipIf(isJSDOM)('Menu enter transition', () => {
  const { render } = createRenderer();

  it('does not play the enter transition for a menu that is open on the first render', async () => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

    const menuTracker = trackStartingStyle('menu-popup');
    const onOpenChangeComplete = vi.fn();
    await render(
      <Menu.Root defaultOpen onOpenChangeComplete={onOpenChangeComplete}>
        <Menu.Trigger>Trigger</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="menu-popup">
              <Menu.Item>Item</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    await waitFor(() => {
      expect(onOpenChangeComplete).toHaveBeenCalledWith(true);
    });

    expect(menuTracker.seen()).toBe(false);
  });

  it('does not play the enter transition for a submenu inside a menu that is open on the first render', async () => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

    const menuTracker = trackStartingStyle('menu-popup');
    const submenuTracker = trackStartingStyle('submenu-popup');
    const onOpenChangeComplete = vi.fn();

    await render(
      <Menu.Root defaultOpen>
        <Menu.Trigger>Trigger</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="menu-popup">
              <Menu.Item>Item</Menu.Item>
              <Menu.SubmenuRoot defaultOpen onOpenChangeComplete={onOpenChangeComplete}>
                <Menu.SubmenuTrigger>Submenu</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup data-testid="submenu-popup">
                      <Menu.Item>Sub item</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });
    await waitFor(() => {
      expect(onOpenChangeComplete).toHaveBeenCalledWith(true);
    });

    expect(menuTracker.seen()).toBe(false);
    expect(submenuTracker.seen()).toBe(false);
  });

  it('plays the enter transition for a submenu opened by the user', async () => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

    const submenuTracker = trackStartingStyle('submenu-popup');

    const { user } = await render(
      <Menu.Root defaultOpen>
        <Menu.Trigger>Trigger</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="menu-popup">
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger>Submenu</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup data-testid="submenu-popup">
                      <Menu.Item>Sub item</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    await user.click(screen.getByRole('menuitem', { name: 'Submenu' }));

    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });
    await waitFor(() => {
      expect(submenuTracker.seen()).toBe(true);
    });
  });

  describe('a submenu that is open when its parent opens', () => {
    // The parent opens with a change of the store, as a press of its trigger does. A keyboard
    // click opens the parent instantly.
    async function renderMenu(
      options: { submenuOpen?: boolean; showSubmenuPopup?: boolean; style?: string } = {},
    ) {
      const probe = createMenuStoreProbe();
      const onOpenChangeComplete = vi.fn();
      const submenuOpen = shallowRef(options.submenuOpen ?? true);
      const showSubmenuPopup = shallowRef(options.showSubmenuPopup ?? true);
      const Test = defineComponent({
        setup() {
          return () => (
            <div>
              {options.style ? <style>{options.style}</style> : null}
              <Menu.Root onOpenChangeComplete={onOpenChangeComplete}>
                <probe.Probe />
                <Menu.Trigger>Trigger</Menu.Trigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup data-testid="menu-popup">
                      <Menu.Item>Item</Menu.Item>
                      <Menu.SubmenuRoot open={submenuOpen.value}>
                        <Menu.SubmenuTrigger>Submenu</Menu.SubmenuTrigger>
                        {showSubmenuPopup.value ? (
                          <Menu.Portal>
                            <Menu.Positioner>
                              <Menu.Popup data-testid="submenu-popup">
                                <Menu.Item>Sub item</Menu.Item>
                              </Menu.Popup>
                            </Menu.Positioner>
                          </Menu.Portal>
                        ) : null}
                      </Menu.SubmenuRoot>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            </div>
          );
        },
      });
      await render(<Test />);

      function openParent(keyboard: boolean) {
        probe.store.setOpen(
          true,
          createChangeEventDetails(
            REASONS.triggerPress,
            new MouseEvent('click', { detail: keyboard ? 0 : 1 }),
            screen.getByRole('button', { name: 'Trigger' }),
          ),
        );
      }

      return { openParent, submenuOpen, showSubmenuPopup, onOpenChangeComplete };
    }

    it('plays the enter transition of the submenu with the enter transition of its parent', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const submenuTracker = trackStartingStyle('submenu-popup');
      const { openParent } = await renderMenu();

      openParent(false);

      await waitFor(() => {
        expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
      });
      await waitFor(() => {
        expect(submenuTracker.seen()).toBe(true);
      });
    });

    it('marks the submenu as instant while it enters, when its parent opened instantly', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const submenuInstantTracker = trackSelector(
        '[data-testid="submenu-popup"][data-instant="click"]',
      );
      const { openParent } = await renderMenu();

      openParent(true);

      await waitFor(() => {
        expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
      });
      expect(screen.getByTestId('menu-popup')).toHaveAttribute('data-instant', 'click');
      await waitFor(() => {
        expect(submenuInstantTracker.seen()).toBe(true);
      });
      await waitFor(() => {
        expect(screen.getByTestId('submenu-popup')).not.toHaveAttribute('data-instant');
      });
    });

    it('clears the inherited instant type when a controlled close interrupts the entry', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const { openParent, submenuOpen } = await renderMenu({
        style: `
          [data-testid='submenu-popup'] { opacity: 1; transition: opacity 300ms linear; }
          [data-testid='submenu-popup'][data-starting-style] { opacity: 0; }
        `,
      });

      openParent(true);
      await waitFor(() => {
        expect(screen.getByTestId('submenu-popup')).toHaveAttribute('data-instant', 'click');
      });

      submenuOpen.value = false;
      await waitFor(() => {
        expect(screen.queryByTestId('submenu-popup')).toBe(null);
      });

      submenuOpen.value = true;
      await waitFor(() => {
        expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
      });
      expect(screen.getByTestId('submenu-popup')).not.toHaveAttribute('data-instant');
    });

    it('clears the inherited instant type when the popup of the submenu is not rendered', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const { openParent, showSubmenuPopup, onOpenChangeComplete } = await renderMenu({
        showSubmenuPopup: false,
      });

      openParent(true);
      expect(await screen.findByTestId('menu-popup')).toHaveAttribute('data-instant', 'click');
      // The reveal of the parent ends while the popup of the submenu is absent.
      await waitFor(() => {
        expect(onOpenChangeComplete).toHaveBeenCalledWith(true);
      });
      await flushMicrotasks();

      showSubmenuPopup.value = true;
      await waitFor(() => {
        expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
      });
      expect(screen.getByTestId('submenu-popup')).not.toHaveAttribute('data-instant');
    });
  });
});
