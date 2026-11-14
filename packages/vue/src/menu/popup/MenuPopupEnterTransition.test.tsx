import { describe, expect, it, onTestFinished, vi } from 'vitest';
import * as Menu from '../index.parts';
import { createRenderer, isJSDOM, waitFor } from '#test-utils';

describe.skipIf(isJSDOM)('Menu enter transition', () => {
  const { render } = createRenderer();

  it('does not play the enter transition for a menu that is open on the first render', async () => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

    // `data-starting-style` lasts one frame, so an observer records it.
    const selector = '[data-testid="menu-popup"][data-starting-style]';
    let hasStartingStyle = false;
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'attributes' && (record.target as Element).matches(selector)) {
          hasStartingStyle = true;
        }
        for (const node of record.addedNodes) {
          if (node instanceof Element && (node.matches(selector) || node.querySelector(selector))) {
            hasStartingStyle = true;
          }
        }
      }
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-starting-style'],
      childList: true,
      subtree: true,
    });
    onTestFinished(() => observer.disconnect());

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

    expect(hasStartingStyle).toBe(false);
  });
});
