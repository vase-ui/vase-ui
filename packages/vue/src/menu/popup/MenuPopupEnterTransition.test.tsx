import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { defineComponent } from 'vue';
import * as Menu from '../index.parts';
import { createRenderer, flushMicrotasks, isJSDOM, screen, wait, waitFor } from '#test-utils';
import type { VaseUIRenderResult } from '#test-utils';

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

/**
 * The menu of the cases that open a submenu with its parent. The props give the differences
 * between the Base UI cases.
 */
const App = defineComponent({
  props: {
    submenuOpen: { type: Boolean, default: undefined },
    submenuDefaultOpen: { type: Boolean, default: false },
    keepMounted: { type: Boolean, default: false },
    showPopup: { type: Boolean, default: true },
    style: { type: String, default: undefined },
  },
  setup(props) {
    return () => (
      <div>
        {props.style ? <style>{props.style}</style> : null}
        <Menu.Root>
          <Menu.Trigger>Trigger</Menu.Trigger>
          <Menu.Portal keepMounted={props.keepMounted}>
            <Menu.Positioner>
              <Menu.Popup data-testid="menu-popup">
                <Menu.Item>Item</Menu.Item>
                <Menu.SubmenuRoot open={props.submenuOpen} defaultOpen={props.submenuDefaultOpen}>
                  <Menu.SubmenuTrigger>Submenu</Menu.SubmenuTrigger>
                  {props.showPopup ? (
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

/** Opens the menu with Enter on its trigger: a keyboard click, which opens it instantly. */
async function openWithEnter(user: VaseUIRenderResult['user']) {
  screen.getByRole('button', { name: 'Trigger' }).focus();
  await flushMicrotasks();
  await user.keyboard('[Enter]');
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

  it('plays the enter transition for a submenu that is open when its parent opens', async () => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

    const submenuTracker = trackStartingStyle('submenu-popup');

    const { user } = await render(<App submenuDefaultOpen />);

    await user.click(screen.getByRole('button', { name: 'Trigger' }));

    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });
    await waitFor(() => {
      expect(submenuTracker.seen()).toBe(true);
    });
  });

  it('plays the enter transition for a controlled-open submenu when its parent opens', async () => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

    const submenuTracker = trackStartingStyle('submenu-popup');

    const { user } = await render(<App submenuOpen />);

    await user.click(screen.getByRole('button', { name: 'Trigger' }));

    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });
    await waitFor(() => {
      expect(submenuTracker.seen()).toBe(true);
    });
  });

  it('does not play the enter transition for a submenu when the parent popup is kept mounted', async () => {
    // Known limitation: with a `keepMounted` parent the submenu subtree exists from page load, so
    // its mount cannot be tied to the parent's reveal and the submenu appears without a
    // transition when the parent opens. This test pins the current behavior; a fix needs a
    // visibility-based signal in the shared transition machinery.
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

    const submenuTracker = trackStartingStyle('submenu-popup');

    const { user } = await render(<App keepMounted submenuDefaultOpen />);

    await user.click(screen.getByRole('button', { name: 'Trigger' }));

    await waitFor(() => {
      expect(screen.getByTestId('menu-popup')).toBeVisible();
    });

    await wait(100);

    expect(submenuTracker.seen()).toBe(false);
  });

  it('plays the enter transition for a submenu whose parent opened instantly', async () => {
    // `data-instant` is a styling hint: suppressing the enter transition is the consumer's
    // choice, not the framework's. A consumer without `[data-instant]` CSS gets the parent's
    // enter transition on a keyboard open, so the submenu must go through `'starting'` alongside
    // it — skipping the phase would re-create the detached-panel artifact for keyboard users.
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

    const submenuTracker = trackStartingStyle('submenu-popup');

    const { user } = await render(<App submenuDefaultOpen />);

    await openWithEnter(user);

    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });
    await waitFor(() => {
      expect(submenuTracker.seen()).toBe(true);
    });
  });

  it('marks an initially open submenu as instant when its parent opened instantly', async () => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

    const submenuInstantTracker = trackSelector(
      '[data-testid="submenu-popup"][data-instant="click"]',
    );

    const { user } = await render(<App submenuDefaultOpen />);

    await openWithEnter(user);

    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });
    expect(screen.getByTestId('menu-popup')).toHaveAttribute('data-instant', 'click');
    // The submenu carries the inherited value during its enter frames only: it is cleared once
    // the initial reveal settles, so it cannot suppress later transitions.
    await waitFor(() => {
      expect(submenuInstantTracker.seen()).toBe(true);
    });
    await waitFor(() => {
      expect(screen.getByTestId('submenu-popup')).not.toHaveAttribute('data-instant');
    });
  });

  it('clears the inherited instant type after the initial open', async () => {
    // The inherited `instantType` must not outlive the initial reveal: controlled `open` flips
    // bypass `setOpen`, so a value that stuck around would render `[data-instant]` on every
    // subsequent open and suppress transitions that should play.
    const { user, setProps } = await render(() => <App submenuOpen />);

    await openWithEnter(user);

    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });
    await waitFor(() => {
      expect(screen.getByTestId('submenu-popup')).not.toHaveAttribute('data-instant');
    });

    await setProps({ submenuOpen: false });
    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).toBe(null);
    });

    await setProps({ submenuOpen: true });
    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });
    expect(screen.getByTestId('submenu-popup')).not.toHaveAttribute('data-instant');
  });

  it('clears the inherited instant type when a controlled close interrupts the entry', async () => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

    // The transition keeps the animations-finished cleanup pending long enough for the controlled
    // close to interrupt it; there is no ending style, so closing unmounts without delay.
    const style = `
      [data-testid='submenu-popup'] {
        opacity: 1;
        transition: opacity 300ms linear;
      }
      [data-testid='submenu-popup'][data-starting-style] {
        opacity: 0;
      }
    `;
    const { user, setProps } = await render(() => <App submenuOpen style={style} />);

    await openWithEnter(user);

    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });

    // Close before the 300ms enter transition finishes, then reopen.
    await setProps({ submenuOpen: false });
    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).toBe(null);
    });

    await setProps({ submenuOpen: true });
    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });
    expect(screen.getByTestId('submenu-popup')).not.toHaveAttribute('data-instant');
  });

  it('clears the inherited instant type when the popup is not initially rendered', async () => {
    // With the popup subtree omitted at mount (e.g. suspended or waiting on data), there is no
    // element for the animations-finished callback to watch, and a ref assignment alone never
    // reruns the clearing effect. The seed must still be cleared, so a popup rendered after the
    // reveal settles does not carry a stale `[data-instant]`.
    const { user, setProps } = await render(() => <App submenuDefaultOpen showPopup={false} />);

    await openWithEnter(user);

    await waitFor(() => {
      expect(screen.getByTestId('menu-popup')).toHaveAttribute('data-instant', 'click');
    });
    // Give the reveal time to settle while the submenu popup is absent.
    await wait(100);

    await setProps({ showPopup: true });
    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });
    expect(screen.getByTestId('submenu-popup')).not.toHaveAttribute('data-instant');
  });

  it('does not mark a closed submenu as instant when it is later opened programmatically', async () => {
    // A submenu that mounts closed during the parent's enter transition must not inherit the
    // parent's `instantType`: a later programmatic open (controlled `open` flip) does not go
    // through `setOpen`, so a seeded value would never be cleared. `defaultOpen` is set alongside
    // the controlled prop to pin that the gate resolves the effective open state — the controlled
    // `open={false}` must win over `defaultOpen`.
    const { user, setProps } = await render(() => <App submenuOpen={false} submenuDefaultOpen />);

    await openWithEnter(user);

    await waitFor(() => {
      expect(screen.queryByTestId('menu-popup')).not.toBe(null);
    });
    expect(screen.getByTestId('menu-popup')).toHaveAttribute('data-instant', 'click');

    await setProps({ submenuOpen: true });

    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });
    expect(screen.getByTestId('submenu-popup')).not.toHaveAttribute('data-instant');
  });
});
