import { describe, expect, onTestFinished, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick } from 'vue';
import DrawerParts from '../../test/fixtures/DrawerParts.vue';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const get = (id: string) => byTestId(id)!;

async function mountDrawer(setup: Props) {
  const result = mount(DrawerParts, setup);
  await nextTick();
  return result;
}

async function opened(prefix = '') {
  await waitFor(() => expect(byTestId(`${prefix}popup`)).not.toBe(null));
  return get(`${prefix}popup`);
}

describe('a nested drawer', () => {
  test('gives the drawer below the height of its popup with its border', async () => {
    await mountDrawer({
      root: { defaultOpen: true },
      nested: {
        root: { defaultOpen: true },
        popup: { style: 'height: 100px; border-top: 2px solid; border-bottom: 2px solid' },
      },
    });
    const parent = await opened();
    const child = await opened('nested-');
    await waitFor(() =>
      expect(parent.style.getPropertyValue('--drawer-frontmost-height')).toBe(
        `${child.offsetHeight}px`,
      ),
    );
    expect(child.offsetHeight).toBe(104);
  });

  test('ends the nested state of the drawer below at the start of its leave, and leaves its height there until the end of the leave', async () => {
    // A leave of 1 s keeps the nested popup in the DOM while the case reads the drawer below.
    const slowLeave = document.head.appendChild(document.createElement('style'));
    slowLeave.textContent = '.drawer-test-leave-active { transition-duration: 1s; }';
    onTestFinished(() => slowLeave.remove());
    await mountDrawer({
      root: { defaultOpen: true },
      nested: { root: { defaultOpen: true }, transition: true },
    });
    const parent = await opened();
    const child = await opened('nested-');
    await waitFor(() => expect(parent.style.getPropertyValue('--nested-drawers')).toBe('1'));
    expect(parent).toHaveAttribute('data-nested-drawer-open');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(child.classList.contains('drawer-test-leave-active')).toBe(true));
    expect(parent.style.getPropertyValue('--nested-drawers')).toBe('0');
    expect(parent).not.toHaveAttribute('data-nested-drawer-open');
    expect(parent.style.getPropertyValue('--drawer-height')).toBe('300px');
    await waitFor(() => expect(child.isConnected).toBe(false));
    await waitFor(() => expect(parent.style.getPropertyValue('--drawer-height')).toBe(''));
  });

  test('sets the height of the drawer below no later than its nested state at a new open', async () => {
    await mountDrawer({
      root: { defaultOpen: true },
      nested: { root: { defaultOpen: false } },
    });
    const parent = await opened();
    const states: { nested: boolean; height: string }[] = [];
    const observer = new MutationObserver(() =>
      states.push({
        nested: parent.hasAttribute('data-nested-drawer-open'),
        height: parent.style.getPropertyValue('--drawer-height'),
      }),
    );
    observer.observe(parent, {
      attributes: true,
      attributeFilter: ['data-nested-drawer-open', 'style'],
    });
    onTestFinished(() => observer.disconnect());
    await userEvent.click(get('nested-trigger'));
    await opened('nested-');
    await waitFor(() => expect(parent).toHaveAttribute('data-nested-drawer-open'));
    const first = states.find((state) => state.nested);
    expect(first?.height).toBe('300px');
  });

  test('keeps the height of the drawer below at a new open until the nested popup has a height', async () => {
    // The stack formula of the Drawer page.
    const stack = document.head.appendChild(document.createElement('style'));
    stack.textContent = `.drawer-test-popup {
      --stack-height: max(0px, calc(var(--drawer-frontmost-height, var(--drawer-height)) - 3rem));
    }
    .drawer-test-popup[data-nested-drawer-open] {
      height: calc(var(--stack-height) + 3rem);
    }`;
    onTestFinished(() => stack.remove());
    await mountDrawer({
      root: { defaultOpen: true },
      nested: { root: { defaultOpen: false }, popup: { style: 'height: 200px' } },
    });
    const parent = await opened();
    const heights: number[] = [];
    const observer = new MutationObserver(() => heights.push(parent.offsetHeight));
    observer.observe(parent, { attributes: true, attributeFilter: ['style'] });
    onTestFinished(() => observer.disconnect());
    await userEvent.click(get('nested-trigger'));
    await opened('nested-');
    await waitFor(() => expect(parent.offsetHeight).toBe(200));
    expect(Math.min(...heights)).toBe(200);
  });
});
