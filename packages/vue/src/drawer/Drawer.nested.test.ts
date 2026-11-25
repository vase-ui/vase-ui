import { describe, expect, onTestFinished, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick } from 'vue';
import DrawerParts from '../../test/fixtures/DrawerParts.vue';
import { finishAnimations } from '../../test/animation';
import { mount } from '../../test/render';
import { readWhen } from '../../test/wait';
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
    await mountDrawer({
      root: { defaultOpen: true },
      nested: { root: { defaultOpen: true }, transition: true },
    });
    const parent = await opened();
    const child = await opened('nested-');
    await waitFor(() => expect(parent.style.getPropertyValue('--drawer-height')).toBe('300px'));
    expect(parent.style.getPropertyValue('--nested-drawers')).toBe('1');
    expect(parent).toHaveAttribute('data-nested-drawer-open');
    // When a leave starts in the enter, CSS shortens the leave by the part of the enter that did not
    // run (https://drafts.csswg.org/css-transitions-1/#reversing). The leave can then end before
    // the command of the key, so the case reads the drawer below when the leave starts.
    const atLeave = readWhen(
      () => child.classList.contains('drawer-test-leave-active'),
      () => ({
        nestedDrawers: parent.style.getPropertyValue('--nested-drawers'),
        nestedDrawerOpen: parent.hasAttribute('data-nested-drawer-open'),
        height: parent.style.getPropertyValue('--drawer-height'),
      }),
    );
    await userEvent.keyboard('{Escape}');
    expect(await atLeave).toEqual({ nestedDrawers: '0', nestedDrawerOpen: false, height: '300px' });
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

  test('keeps the own height of a drawer that opens with an open nested drawer', async () => {
    // The stack formula of the Drawer page.
    const stack = document.head.appendChild(document.createElement('style'));
    stack.textContent = `.drawer-test-popup {
      --stack-height: max(0px, calc(var(--drawer-frontmost-height, var(--drawer-height)) - 3rem));
      height: var(--drawer-height, auto);
    }
    .drawer-test-popup[data-nested-drawer-open] {
      height: calc(var(--stack-height) + 3rem);
    }`;
    onTestFinished(() => stack.remove());
    await mountDrawer({
      root: { defaultOpen: true },
      nested: { root: { defaultOpen: true }, popup: { style: 'height: 200px' } },
    });
    const parent = await opened();
    await opened('nested-');
    await waitFor(() => expect(parent.offsetHeight).toBe(200));
    const kept = parent.style.getPropertyValue('--drawer-height');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(parent.style.getPropertyValue('--drawer-height')).toBe(''));
    expect(kept).toBe(`${parent.offsetHeight}px`);
  });

  test('a nested popup that grows after it opens gives no resize loop error when the drawer below follows `--drawer-frontmost-height`', async () => {
    const stack = document.head.appendChild(document.createElement('style'));
    stack.textContent = `.drawer-test-popup[data-nested-drawer-open] {
      height: var(--drawer-frontmost-height, var(--drawer-height));
      transition: none;
    }`;
    onTestFinished(() => stack.remove());
    await mountDrawer({
      root: { defaultOpen: true },
      nested: { root: { defaultOpen: true }, popup: { style: 'height: auto; transition: none' } },
    });
    const parent = await opened();
    const child = await opened('nested-');
    await waitFor(() =>
      expect(parent.style.getPropertyValue('--drawer-frontmost-height')).toBe(
        `${child.offsetHeight}px`,
      ),
    );
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const errors: string[] = [];
    const onError = (event: ErrorEvent) => errors.push(event.message);
    window.addEventListener('error', onError);
    onTestFinished(() => window.removeEventListener('error', onError));

    const before = child.offsetHeight;
    get('nested-text').style.paddingBottom = '40px';
    await waitFor(() => expect(parent.offsetHeight).toBe(before + 40));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(errors).toEqual([]);
    expect(parent.style.getPropertyValue('--drawer-frontmost-height')).toBe(`${before + 40}px`);
  });

  test('an open while a nested drawer leaves keeps the same popup and the height of the parent', async () => {
    const style = document.head.appendChild(document.createElement('style'));
    style.textContent = '.drawer-test-leave-active { transition-duration: 100s; }';
    onTestFinished(() => style.remove());
    await mountDrawer({
      root: { defaultOpen: true },
      nested: {
        root: { defaultOpen: true },
        popup: { style: 'height: 200px' },
        transition: true,
      },
    });
    const parent = await opened();
    const child = await opened('nested-');
    await finishAnimations(child);
    await waitFor(() => expect(child).not.toHaveClass('drawer-test-enter-active'));
    await waitFor(() => expect(parent.style.getPropertyValue('--drawer-height')).toBe('300px'));
    await waitFor(() =>
      expect(parent.style.getPropertyValue('--drawer-frontmost-height')).toBe('200px'),
    );
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(child).toHaveClass('drawer-test-leave-active'));
    expect(parent).not.toHaveAttribute('data-nested-drawer-open');
    expect(parent.style.getPropertyValue('--drawer-height')).toBe('300px');
    await userEvent.click(get('nested-trigger'));
    await waitFor(() => expect(child).not.toHaveClass('drawer-test-leave-active'));
    expect([...document.querySelectorAll('[data-testid="nested-popup"]')]).toEqual([child]);
    expect(parent).toHaveAttribute('data-nested-drawer-open');
    expect(parent.style.getPropertyValue('--nested-drawers')).toBe('1');
    expect(parent.style.getPropertyValue('--drawer-height')).toBe('300px');
    expect(parent.style.getPropertyValue('--drawer-frontmost-height')).toBe('200px');
  });
});
