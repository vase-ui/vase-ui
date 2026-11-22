import { afterEach, describe, expect, onTestFinished, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { NavigationMenuRootChangeEventDetails } from '@vase-ui/vue/navigation-menu';
import NavigationMenuParts from '../../test/fixtures/NavigationMenuParts.vue';
import { hydrate, mount, renderOnServer } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const get = (id: string) => byTestId(id)!;
const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function mountMenu(setup: Props = {}) {
  const result = mount(NavigationMenuParts, setup);
  await nextTick();
  return result;
}

async function shows(item: string) {
  await waitFor(() => expect(byTestId(`content-${item}`)).not.toBe(null));
  await waitFor(() => expect(get(`content-${item}`)).not.toHaveAttribute('hidden'));
}

/** Tab, with Option in WebKit, where Tab reaches a link only by a setting of the system. */
async function tab(shift = false) {
  const [down, up] = server.browser === 'webkit' ? ['{Alt>}', '{/Alt}'] : ['', ''];
  await userEvent.keyboard(shift ? `${down}{Shift>}{Tab}{/Shift}${up}` : `${down}{Tab}${up}`);
}

afterEach(async () => {
  await frame();
});

describe('the first place', () => {
  test('a kept portal that a press opens has `data-instant` on its positioner for its first place only', async () => {
    await mountMenu({ portal: { keepMounted: true }, arrow: {} });
    get('trigger-one').click();
    await nextTick();
    expect(get('positioner')).toHaveAttribute('data-instant');
    await waitFor(() => expect(get('positioner')).not.toHaveAttribute('data-instant'));
  });

  test('a root that is open at the mount has `data-instant` on its positioner for its first place only', async () => {
    let first: boolean | undefined;
    const observer = new MutationObserver(() => {
      first ??= byTestId('positioner')?.hasAttribute('data-instant');
    });
    observer.observe(document.body, { childList: true, subtree: true });
    onTestFinished(() => observer.disconnect());
    await mountMenu({ root: { defaultValue: 'one' } });
    await waitFor(() => expect(byTestId('positioner')).not.toBe(null));
    expect(first).toBe(true);
    await waitFor(() => expect(get('positioner')).not.toHaveAttribute('data-instant'));
  });

  test('the server HTML of a root that is open at the mount hydrates, and its positioner loses `data-instant` after its first place', async () => {
    const props = { root: { defaultValue: 'one' } };
    const root = await renderOnServer('NavigationMenuParts', props);
    hydrate(NavigationMenuParts, props, root);
    await waitFor(() => expect(byTestId('positioner')).not.toBe(null));
    await waitFor(() => expect(get('positioner').style.visibility).toBe(''));
    await waitFor(() => expect(get('positioner')).not.toHaveAttribute('data-instant'));
  });
});

describe('a controlled value', () => {
  test('a close by the parent after a move to another trigger leaves the content with no activation direction', async () => {
    const root = reactive<Props>({ modelValue: 'one' });
    root['onUpdate:modelValue'] = (value: unknown) => (root.modelValue = value);
    await mountMenu({
      root,
      popup: { class: 'animated' },
      popupTransition: { name: 'slide' },
    });
    await shows('one');
    await userEvent.click(get('trigger-two'));
    await shows('two');
    expect(get('content-two')).toHaveAttribute('data-activation-direction', 'right');
    const content = get('content-two');
    root.modelValue = null;
    await nextTick();
    await frame();
    expect(content).not.toHaveAttribute('data-activation-direction');
  });

  test('`close()` on a root that is closed emits nothing', async () => {
    const log: string[] = [];
    const { exposed } = await mountMenu({
      root: {
        defaultValue: 'one',
        onValueChange: (value: unknown, details: NavigationMenuRootChangeEventDetails) =>
          log.push(`${String(value)} ${details.reason}`),
      },
    });
    await shows('one');
    exposed.root.close();
    exposed.root.close();
    await wait(50);
    expect(log).toEqual(['null imperative-action']);
  });

  test('a link with `closeOnClick` in a nested item whose value is falsy closes the parent', async () => {
    await mountMenu({
      inline: true,
      nested: { root: { defaultValue: false }, valueA: false },
    });
    await userEvent.click(get('trigger-one'));
    await shows('one');
    expect(get('trigger-sub-a')).toHaveAttribute('aria-expanded', 'true');
    // The link is in the inline content under the content of `one`, out of its box.
    get('link-sub-a').click();
    await waitFor(() => expect(get('trigger-one')).toHaveAttribute('aria-expanded', 'false'));
  });
});

describe('the Tab key', () => {
  test('Shift+Tab out of the root from a content closes the menu', async () => {
    await mountMenu();
    get('trigger-one').focus();
    await userEvent.click(get('trigger-one'));
    await shows('one');
    get('trigger-one').focus();
    await tab();
    expect(document.activeElement).toBe(get('link-one-a'));
    await tab(true);
    expect(document.activeElement).toBe(get('trigger-one'));
    await tab(true);
    await waitFor(() => expect(byTestId('popup')).toBe(null));
  });

  test('Shift+Tab after Tab out of an inline nested content goes back to its last link', async () => {
    await mountMenu({
      inline: true,
      moreLinks: 0,
      nested: { root: { defaultValue: 'sub-a' } },
    });
    await userEvent.click(get('trigger-one'));
    await shows('one');
    await shows('sub-a');
    get('trigger-sub-a').focus();
    await tab();
    expect(document.activeElement).toBe(get('link-sub-a'));
    await tab();
    expect(document.activeElement).toBe(get('trigger-sub-b'));
    await tab(true);
    expect(document.activeElement).toBe(get('link-sub-a'));
  });
});

describe('a kept popup that leaves', () => {
  test('a hover on another trigger while a kept popup leaves gives `--popup-width` the width of the panel that leaves, then the new width', async () => {
    await mountMenu({
      portal: { keepMounted: true },
      popup: { class: 'sized fades' },
      contents: {
        one: { style: 'width: 675px; height: 220px' },
        two: { style: 'width: 500px; height: 180px' },
      },
    });
    await userEvent.hover(get('trigger-one'));
    await shows('one');
    await waitFor(() => expect(get('popup').getAnimations()).toEqual([]));
    const popup = get('popup');
    const widths: string[] = [];
    const observer = new MutationObserver(() =>
      widths.push(popup.style.getPropertyValue('--popup-width')),
    );
    observer.observe(popup, { attributeFilter: ['style'] });
    onTestFinished(() => observer.disconnect());
    // A top-level link with no content: the pointer leaves the trigger, and the popup closes.
    await userEvent.hover(get('link-blog'));
    await waitFor(() => expect(popup).toHaveAttribute('hidden'));
    expect(get('positioner')).not.toHaveAttribute('hidden');
    expect(popup.contains(get('content-one'))).toBe(true);
    expect(popup.offsetWidth).toBe(675);
    await userEvent.hover(get('trigger-two'));
    await shows('two');
    expect(get('popup')).toBe(popup);
    await waitFor(() => expect(widths).toContain('500px'));
    expect(widths.indexOf('675px')).toBeGreaterThan(-1);
    expect(widths.lastIndexOf('500px')).toBeGreaterThan(widths.indexOf('675px'));
    expect(get('positioner').style.getPropertyValue('--positioner-width')).toBe('500px');
    await waitFor(() => expect(popup.style.getPropertyValue('--popup-width')).toBe(''));
    expect(popup.offsetWidth).toBe(500);
  });

  test('a hover on another trigger while a kept popup leaves after a press outside opens its item with no delay', async () => {
    await mountMenu({
      root: { delay: 10_000 },
      portal: { keepMounted: true },
      popup: { class: 'fades' },
    });
    await userEvent.click(get('trigger-one'));
    await shows('one');
    await waitFor(() => expect(get('popup').getAnimations()).toEqual([]));
    await userEvent.click(document.getElementById('outside')!);
    await waitFor(() => expect(get('popup')).toHaveAttribute('hidden'));
    await userEvent.hover(get('trigger-two'));
    await shows('two');
  });

  test('a kept popup with no leave hides its positioner and drops its content at the close', async () => {
    await mountMenu({ portal: { keepMounted: true } });
    await userEvent.click(get('trigger-one'));
    await shows('one');
    await userEvent.click(document.getElementById('outside')!);
    await waitFor(() => expect(get('positioner')).toHaveAttribute('hidden'));
    expect(get('popup')).toHaveAttribute('hidden');
    expect(byTestId('content-one')).toBe(null);
  });
});
