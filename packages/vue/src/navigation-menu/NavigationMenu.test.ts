import { afterEach, describe, expect, inject, onTestFinished, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { NavigationMenuRootChangeEventDetails } from '@vase-ui/vue/navigation-menu';
import NavigationMenuParts from '../../test/fixtures/NavigationMenuParts.vue';
import NavigationMenuPartAlone from '../../test/fixtures/NavigationMenuPartAlone.vue';
import NavigationMenuRouterLinks from '../../test/fixtures/NavigationMenuRouterLinks.vue';
import NavigationMenuScoped from '../../test/fixtures/NavigationMenuScoped.vue';
import NavigationMenuWithDialog from '../../test/fixtures/NavigationMenuWithDialog.vue';
import TabsInNavigationMenu from '../../test/fixtures/TabsInNavigationMenu.vue';
import { mount, mountError } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string, root: ParentNode = document) =>
  root.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const get = (id: string, root: ParentNode = document) => byTestId(id, root)!;
const byId = (id: string) => document.getElementById(id)!;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

async function mountMenu(setup: Props = {}) {
  const result = mount(NavigationMenuParts, setup);
  await nextTick();
  return result;
}

/** Props of a root that write each event in `log`. */
function rootEvents(log: string[], props: Props = {}) {
  return reactive<Props>({
    ...props,
    onValueChange: (value: unknown, details: NavigationMenuRootChangeEventDetails) =>
      log.push(`valueChange ${String(value)} ${details.reason}`),
    'onUpdate:modelValue': (value: unknown) => log.push(`update ${String(value)}`),
  });
}

/** Waits for the content of the item in the viewport, and gives its element. */
async function shows(item: string) {
  await waitFor(() => expect(byTestId(`content-${item}`)).not.toBe(null));
  await waitFor(() => expect(get(`content-${item}`)).not.toHaveAttribute('hidden'));
  return get(`content-${item}`);
}

async function opened() {
  await waitFor(() => expect(byTestId('popup')).not.toBe(null));
  return get('popup');
}

async function closed() {
  await waitFor(() => expect(byTestId('popup')).toBe(null));
}

async function placed() {
  await waitFor(() => expect(get('positioner').style.visibility).toBe(''));
}

function centerOf(element: Element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function pathOf(element: Element | null) {
  const path: Element[] = [];
  for (let node = element; node; node = node.parentElement) path.push(node);
  return path;
}

/**
 * Moves a mouse pointer from `from` through the points, as a browser does: the boundary events of
 * each element that the pointer leaves or enters, then `pointermove`.
 */
async function movePointer(from: { x: number; y: number }, points: { x: number; y: number }[]) {
  let under = document.elementFromPoint(from.x, from.y);
  for (const point of points) {
    const target = document.elementFromPoint(point.x, point.y) ?? document.documentElement;
    const init = { pointerType: 'mouse', clientX: point.x, clientY: point.y };
    if (target !== under) {
      const left = pathOf(under);
      const entered = pathOf(target);
      for (const element of left) {
        if (!entered.includes(element))
          element.dispatchEvent(new PointerEvent('pointerleave', init));
      }
      for (const element of entered.reverse()) {
        if (!left.includes(element)) element.dispatchEvent(new PointerEvent('pointerenter', init));
      }
      under = target;
    }
    target.dispatchEvent(
      new PointerEvent('pointermove', { ...init, bubbles: true, composed: true }),
    );
    await wait(10);
  }
}

/** Tab, with Option in WebKit, where Tab reaches a link only by a setting of the system. */
async function tab(shift = false) {
  const [down, up] = server.browser === 'webkit' ? ['{Alt>}', '{/Alt}'] : ['', ''];
  await userEvent.keyboard(shift ? `${down}{Shift>}{Tab}{/Shift}${up}` : `${down}{Tab}${up}`);
}

afterEach(async () => {
  // A popup of the case can still leave.
  await frame();
});

describe('the parts', () => {
  test('render their native elements; a template ref has element; the attributes of the developer win', async () => {
    const { exposed } = await mountMenu({
      root: { defaultValue: 'one' },
      triggers: { one: { type: 'submit' } },
      popup: { tabindex: 0 },
      backdrop: {},
      arrow: {},
    });
    const popup = await opened();
    expect(get('root').localName).toBe('nav');
    expect(get('list').localName).toBe('ul');
    expect(get('trigger-one').parentElement!.localName).toBe('li');
    expect(get('trigger-one').localName).toBe('button');
    expect(get('trigger-one')).toHaveAttribute('type', 'submit');
    expect(get('trigger-two')).toHaveAttribute('type', 'button');
    expect(get('icon-one').localName).toBe('span');
    expect(get('icon-one')).toHaveAttribute('aria-hidden', 'true');
    expect(get('icon-one')).toHaveTextContent('▼');
    expect(get('link-blog').localName).toBe('a');
    expect(popup.localName).toBe('nav');
    expect(popup).toHaveAttribute('tabindex', '0');
    expect(get('backdrop')).toHaveAttribute('role', 'presentation');
    expect(get('arrow')).toHaveAttribute('aria-hidden', 'true');
    expect(get('positioner').parentElement).toBe(document.body);
    expect(exposed.root.element).toBe(get('root'));
    for (const element of [get('root'), get('list'), get('trigger-one'), popup]) {
      expect(element).not.toHaveAttribute('aria-orientation');
    }
  });

  test('a root in a root renders a <div>; `as` and the `element` slot replace the element', async () => {
    await mountMenu({
      root: { defaultValue: 'one' },
      triggers: { two: { as: 'span' } },
      list: { as: 'ol' },
      nested: { root: { defaultValue: 'sub-a' } },
    });
    await shows('one');
    expect(get('nested-root').localName).toBe('div');
    expect(get('list').localName).toBe('ol');
    expect(get('trigger-two').localName).toBe('span');
    expect(get('trigger-two')).toHaveAttribute('role', 'button');
    expect(get('trigger-two')).toHaveAttribute('tabindex', '0');
    expect(get('trigger-two')).not.toHaveAttribute('type');
  });
});

describe('the value', () => {
  test('a press opens an item, a press on another trigger moves the menu, and a press on the active trigger closes it; valueChange comes before update', async () => {
    const log: string[] = [];
    await mountMenu({ root: rootEvents(log) });
    // A click of the DOM moves no pointer, so no hover joins the log.
    get('trigger-one').click();
    const content = await shows('one');
    expect(get('viewport').contains(content)).toBe(true);
    expect(get('trigger-one')).toHaveAttribute('aria-expanded', 'true');
    expect(get('trigger-one')).toHaveAttribute('aria-controls', content.id);
    expect(get('trigger-two')).toHaveAttribute('aria-expanded', 'false');
    expect(get('trigger-two')).not.toHaveAttribute('aria-controls');
    get('trigger-two').click();
    await shows('two');
    await waitFor(() => expect(byTestId('content-one')).toBe(null));
    get('trigger-two').click();
    await closed();
    expect(log).toEqual([
      'valueChange one trigger-press',
      'update one',
      'valueChange two trigger-press',
      'update two',
      'valueChange null trigger-press',
      'update null',
    ]);
  });

  test('an item with no `value` has a generated value', async () => {
    const log: string[] = [];
    await mountMenu({ generatedTwo: true, root: rootEvents(log) });
    get('trigger-two').click();
    await shows('two');
    expect(log[0]).toMatch(/^valueChange v-\S+ trigger-press$/);
  });

  test('cancel() keeps the menu as it was, with no update', async () => {
    const log: string[] = [];
    await mountMenu({
      root: {
        onValueChange: (value: unknown, details: NavigationMenuRootChangeEventDetails) => {
          log.push(`valueChange ${String(value)}`);
          details.cancel();
        },
        'onUpdate:modelValue': () => log.push('update'),
      },
    });
    await userEvent.click(get('trigger-one'));
    await wait(20);
    expect(byTestId('popup')).toBe(null);
    expect(log).toEqual(['valueChange one']);
  });

  test.each([0, '', false])('the falsy value %j opens its item', async (value) => {
    const log: string[] = [];
    mount(NavigationMenuParts, { root: rootEvents(log, { defaultValue: value }) });
    // The fixture names its items `one` and `two`, so the value has no item: the menu is open
    // with no content, and the trigger of `one` moves it.
    await opened();
    get('trigger-one').click();
    await shows('one');
    expect(log).toEqual(['valueChange one trigger-press', 'update one']);
  });

  test('a controlled root shows the value of the parent; a parent write, a mount open and close() on a closed root emit nothing', async () => {
    const log: string[] = [];
    const root = rootEvents(log, { modelValue: 'two' });
    const { exposed } = await mountMenu({ root });
    await shows('two');
    root.modelValue = 'one';
    await shows('one');
    get('trigger-two').click();
    await wait(20);
    expect(byTestId('content-two')).toBe(null);
    expect(log).toEqual(['valueChange two trigger-press', 'update two']);
    root.modelValue = null;
    await closed();
    log.length = 0;
    exposed.root.close();
    expect(log).toEqual([]);
  });

  test('close() of the template ref closes with the reason imperative-action', async () => {
    const log: string[] = [];
    const { exposed } = await mountMenu({ root: rootEvents(log, { defaultValue: 'one' }) });
    await shows('one');
    exposed.root.close();
    await closed();
    expect(log).toEqual(['valueChange null imperative-action', 'update null']);
  });

  test('a key on the trigger that changes the item emits one valueChange', async () => {
    const log: string[] = [];
    await mountMenu({ root: rootEvents(log) });
    get('trigger-one').focus();
    await userEvent.keyboard('{ArrowDown}');
    await shows('one');
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(get('trigger-two'));
    await userEvent.keyboard('{ArrowDown}');
    await shows('two');
    expect(log).toEqual([
      'valueChange one list-navigation',
      'update one',
      'valueChange two list-navigation',
      'update two',
    ]);
  });
});

describe('a popup root', () => {
  test('Escape in the content closes the menu, and the focus goes to the trigger with a ring', async () => {
    const log: string[] = [];
    await mountMenu({ root: rootEvents(log) });
    await userEvent.click(get('trigger-one'));
    await shows('one');
    get('link-one-a').focus();
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(document.activeElement).toBe(get('trigger-one'));
    expect(get('trigger-one').matches(':focus-visible')).toBe(true);
    expect(log.at(-2)).toBe('valueChange null escape-key');
  });

  test('VUE-92: a v-if that removes the portal in the update of the close returns the focus in the popup to the trigger', async () => {
    const withPortal = reactive({ shown: true });
    await mountMenu({
      withPortal,
      root: { onValueChange: (value: unknown) => (withPortal.shown = value !== null) },
    });
    await userEvent.click(get('trigger-one'));
    await shows('one');
    await placed();
    get('link-one-a').focus();
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(byTestId('positioner')).toBe(null);
    expect(document.activeElement).toBe(get('trigger-one'));
  });

  test('Escape on a trigger closes the menu, also when an element above the root stops the event', async () => {
    await mountMenu({ root: { defaultValue: 'one' } });
    await shows('one');
    const stop = (event: Event) => event.stopPropagation();
    document.body.addEventListener('keydown', stop);
    try {
      get('trigger-one').focus();
      await userEvent.keyboard('{Escape}');
      await closed();
    } finally {
      document.body.removeEventListener('keydown', stop);
    }
    expect(document.activeElement).toBe(get('trigger-one'));
  });

  test('a press outside closes the menu and moves no focus; a press in the list keeps it open', async () => {
    const log: string[] = [];
    await mountMenu({ root: rootEvents(log) });
    await userEvent.click(get('trigger-one'));
    await shows('one');
    // The gap between the two triggers.
    await userEvent.click(get('list'), {
      position: { x: get('trigger-one').offsetWidth + 4, y: 4 },
    });
    await wait(20);
    expect(byTestId('popup')).not.toBe(null);
    await userEvent.click(byId('outside'));
    await closed();
    // WebKit gives a pressed button no focus.
    expect(document.activeElement).not.toBe(get('trigger-one'));
    expect(log.at(-2)).toBe('valueChange null outside-press');
  });

  test('a press on a trigger of another navigation menu closes the first menu', async () => {
    // The second menu is in the page before the open. A press on an element that comes into
    // `<body>` after the open is not outside.
    mount(NavigationMenuParts, {});
    // Each app makes the same ids, so the trigger has an id of its own.
    mount(NavigationMenuParts, {
      list: { style: 'display: flex; margin: 300px 0 0; padding: 0; list-style: none' },
      triggers: { two: { 'data-testid': 'other', id: 'other' } },
    });
    await nextTick();
    await userEvent.click(get('trigger-one'));
    await shows('one');
    await userEvent.click(get('other'));
    await waitFor(() => expect(get('trigger-one')).toHaveAttribute('aria-expanded', 'false'));
    await waitFor(() => expect(get('other')).toHaveAttribute('aria-expanded', 'true'));
  });

  test('a focus that leaves the root and the popup closes the menu and moves no focus', async () => {
    const log: string[] = [];
    await mountMenu({ root: rootEvents(log) });
    await userEvent.click(get('trigger-one'));
    await shows('one');
    get('trigger-one').focus();
    byId('after').focus();
    await closed();
    expect(document.activeElement).toBe(byId('after'));
    expect(log.at(-2)).toBe('valueChange null focus-out');
  });

  test('a link that loses the focus with no related target keeps the menu open', async () => {
    await mountMenu({ root: { defaultValue: 'one' } });
    await shows('one');
    get('link-one-a').focus();
    get('link-one-a').dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await wait(20);
    expect(byTestId('popup')).not.toBe(null);
  });

  test('a press on a place of the popup with no control, then Escape, puts the focus on the trigger', async () => {
    await mountMenu({ popup: { style: 'padding: 20px' } });
    await userEvent.click(get('trigger-one'));
    const popup = await opened();
    await placed();
    await userEvent.click(popup, { position: { x: 5, y: 5 } });
    expect(document.activeElement).toBe(popup);
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(document.activeElement).toBe(get('trigger-one'));
  });

  test('a link with closeOnClick closes the menu with the reason link-press; one with none keeps it', async () => {
    const log: string[] = [];
    await mountMenu({ root: rootEvents(log, { defaultValue: 'one' }), nested: { root: {} } });
    await shows('one');
    await userEvent.click(get('link-one-a'));
    await wait(20);
    expect(byTestId('popup')).not.toBe(null);
    get('trigger-sub-a').click();
    await shows('sub-a');
    await userEvent.click(get('link-sub-a'));
    await closed();
    expect(log.slice(-2)).toEqual(['valueChange null link-press', 'update null']);
  });
});

describe('an inline root', () => {
  test('opens by a press and changes its item, and does not close by Escape, an outside press, a leave or a press on its trigger', async () => {
    const log: string[] = [];
    await mountMenu({ inline: true, root: rootEvents(log, { delay: 10_000 }) });
    get('trigger-one').click();
    const content = await shows('one');
    expect(get('viewport').contains(content)).toBe(true);
    get('link-one-a').focus();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(byId('outside'));
    get('trigger-one').click();
    await userEvent.hover(get('trigger-one'));
    await userEvent.hover(byId('before'));
    await wait(120);
    expect(byTestId('content-one')).not.toBe(null);
    get('trigger-two').click();
    await shows('two');
    expect(log).toEqual([
      'valueChange one trigger-press',
      'update one',
      'valueChange two trigger-press',
      'update two',
    ]);
  });

  test('stays open when the pointer leaves after a hover open', async () => {
    await mountMenu({ inline: true, root: { delay: 0, closeDelay: 0 } });
    await userEvent.hover(get('trigger-one'));
    await shows('one');
    await userEvent.hover(byId('outside'));
    await wait(80);
    expect(byTestId('content-one')).not.toBe(null);
  });

  test('VUE-98: closes by close(), and the focus in its viewport goes to the trigger', async () => {
    const { exposed } = await mountMenu({ inline: true, root: { defaultValue: 'one' } });
    await shows('one');
    get('link-one-a').focus();
    exposed.root.close();
    await waitFor(() => expect(byTestId('content-one')).toBe(null));
    expect(document.activeElement).toBe(get('trigger-one'));
  });
});

describe('the hover', () => {
  test('a mouse that rests on a trigger for `delay` opens its item and moves no focus; the menu closes `closeDelay` after the pointer left', async () => {
    const log: string[] = [];
    await mountMenu({ root: rootEvents(log, { delay: 60, closeDelay: 60 }) });
    await userEvent.hover(get('trigger-one'));
    await wait(20);
    expect(byTestId('popup')).toBe(null);
    await shows('one');
    expect(document.activeElement).toBe(document.body);
    await userEvent.hover(byId('outside'));
    await wait(20);
    expect(byTestId('popup')).not.toBe(null);
    await closed();
    expect(document.activeElement).toBe(document.body);
    expect(log).toEqual([
      'valueChange one trigger-hover',
      'update one',
      'valueChange null trigger-hover',
      'update null',
    ]);
  });

  test('a pointer that goes from a trigger to another changes the item at once', async () => {
    await mountMenu({ root: { delay: 300 } });
    await userEvent.click(get('trigger-one'));
    await shows('one');
    await userEvent.hover(get('trigger-two'));
    await shows('two');
  });

  test('a pointer that goes from a trigger to a link of the list closes the menu after `closeDelay`', async () => {
    await mountMenu({ root: { delay: 0 } });
    await userEvent.hover(get('trigger-two'));
    await shows('two');
    await userEvent.hover(get('link-blog'));
    await closed();
  });

  test('a disabled trigger keeps the focus with aria-disabled, and opens nothing by hover, press or key', async () => {
    await mountMenu({ root: { delay: 0 }, triggers: { one: { disabled: true } } });
    const trigger = get('trigger-one');
    expect(trigger).toHaveAttribute('aria-disabled', 'true');
    expect(trigger).not.toHaveAttribute('disabled');
    await userEvent.hover(trigger);
    // Playwright waits for an element with aria-disabled to be enabled.
    await userEvent.click(trigger, { force: true });
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');
    await wait(30);
    expect(document.activeElement).toBe(trigger);
    expect(byTestId('popup')).toBe(null);
  });

  test('a press in the first 500 ms after a hover open keeps the menu open; the backdrop lets the pointer through until the press', async () => {
    await mountMenu({ root: { delay: 0 }, backdrop: {} });
    await userEvent.hover(get('trigger-one'));
    await shows('one');
    expect(get('backdrop').style.pointerEvents).toBe('none');
    await userEvent.click(get('trigger-one'));
    await wait(20);
    expect(byTestId('content-one')).not.toBe(null);
    expect(get('backdrop').style.pointerEvents).toBe('');
    await userEvent.hover(byId('outside'));
    await wait(120);
    expect(byTestId('content-one')).not.toBe(null);
  });

  test.each(['popup', 'viewport'] as const)(
    'a pointer that crosses another trigger in the triangle to the %s changes no item; one that rests there opens it',
    async (place) => {
      await mountMenu({
        root: { delay: 0, closeDelay: 200 },
        inline: place === 'viewport',
        list: { style: 'display: flex; gap: 0; margin: 0 0 40px 0; padding: 0; list-style: none' },
        contents: { one: { style: 'width: 400px; height: 100px' } },
      });
      await userEvent.hover(get('trigger-one'));
      const content = await shows('one');
      if (place === 'popup') await placed();
      const start = centerOf(get('trigger-one'));
      const box = content.getBoundingClientRect();
      const to = { x: box.right - 10, y: box.top + 10 };
      // From the trigger across the trigger of `two`, toward the far corner of the content.
      const points = Array.from({ length: 12 }, (_, index) => {
        const t = (index + 1) / 12;
        return { x: start.x + (to.x - start.x) * t, y: start.y + (to.y - start.y) * t };
      });
      const crossed = points.find((point) =>
        get('trigger-two').contains(document.elementFromPoint(point.x, point.y)),
      );
      expect(crossed).toBeDefined();
      await movePointer(start, points);
      expect(get('trigger-one')).toHaveAttribute('aria-expanded', 'true');
      expect(get('trigger-two')).toHaveAttribute('aria-expanded', 'false');
      await movePointer(to, [crossed!]);
      await waitFor(() => expect(get('trigger-two')).toHaveAttribute('aria-expanded', 'true'));
    },
  );
});

describe('the names of the content', () => {
  test('VUE-73: an open trigger with no content in the document has no aria-controls', async () => {
    await mountMenu({ noViewport: true });
    get('trigger-one').click();
    await opened();
    expect(get('trigger-one')).toHaveAttribute('aria-expanded', 'true');
    expect(get('trigger-one')).not.toHaveAttribute('aria-controls');
  });

  test('VUE-86: an open trigger follows the id of its content in aria-controls', async () => {
    const content = reactive<Props>({ id: 'first' });
    await mountMenu({ contents: { one: content } });
    get('trigger-one').click();
    await waitFor(() => expect(get('trigger-one')).toHaveAttribute('aria-controls', 'first'));
    content.id = 'second';
    await waitFor(() => expect(get('trigger-one')).toHaveAttribute('aria-controls', 'second'));
    expect(document.getElementById('second')).toBe(get('content-one'));
  });

  test('VUE-112: a trigger in a disabled fieldset is disabled as a native button, and opens nothing', async () => {
    const fieldset = document.body.appendChild(document.createElement('fieldset'));
    fieldset.disabled = true;
    onTestFinished(() => fieldset.remove());
    mount(NavigationMenuParts, {}, fieldset);
    await nextTick();
    await waitFor(() => expect(get('trigger-one')).toBeDisabled());
    expect(get('trigger-one')).not.toHaveAttribute('aria-disabled');
    expect(get('trigger-one')).not.toHaveAttribute('data-disabled');
    get('trigger-one').click();
    await wait(20);
    expect(byTestId('popup')).toBe(null);
  });
});

describe('the keys', () => {
  test('the arrow keys of the orientation move the focus in the list, with no loop, and stop at an end', async () => {
    await mountMenu();
    const seen: string[] = [];
    document.body.addEventListener('keydown', (event) => seen.push(event.key), { once: false });
    get('trigger-one').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(get('trigger-two'));
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(get('link-blog'));
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(get('link-blog'));
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    expect(document.activeElement).toBe(get('trigger-one'));
    expect(seen.filter((key) => key.startsWith('Arrow'))).toEqual([]);
  });

  test('an arrow key with Alt, Control or Meta moves no focus', async () => {
    await mountMenu();
    get('trigger-one').focus();
    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}{Control>}{ArrowRight}{/Control}');
    expect(document.activeElement).toBe(get('trigger-one'));
  });

  test('a vertical list moves with the up and down keys, and its open key is the right key, the left key in a right-to-left list', async () => {
    await mountMenu({ root: { orientation: 'vertical' }, list: { style: 'display: block' } });
    get('trigger-one').focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(get('trigger-two'));
    await userEvent.keyboard('{ArrowRight}');
    await shows('two');
    expect(document.activeElement).toBe(get('trigger-two'));
    get('trigger-one').click();
    await waitFor(() =>
      expect(get('content-one')).toHaveAttribute('data-activation-direction', 'up'),
    );
    get('trigger-two').click();
    await waitFor(() =>
      expect(get('content-two')).toHaveAttribute('data-activation-direction', 'down'),
    );
    get('trigger-two').click();
    await closed();
    get('trigger-two').focus();
    get('root').setAttribute('dir', 'rtl');
    await userEvent.keyboard('{ArrowUp}');
    await userEvent.keyboard('{ArrowRight}');
    expect(get('trigger-one')).toHaveAttribute('aria-expanded', 'false');
    await userEvent.keyboard('{ArrowLeft}');
    await shows('one');
  });

  test('left and right follow the direction of the list element', async () => {
    await mountMenu({ list: { dir: 'rtl', style: 'display: flex' } });
    get('trigger-one').focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(get('trigger-two'));
  });

  test('the four arrow keys move the focus between the links of a content, with a loop; a nested trigger has no open key', async () => {
    await mountMenu({ root: { defaultValue: 'one' }, nested: { root: {} } });
    await shows('one');
    await placed();
    get('link-one-a').focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(get('link-one-b'));
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(get('trigger-sub-a'));
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(get('trigger-sub-b'));
    expect(get('trigger-sub-b')).toHaveAttribute('aria-expanded', 'false');
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(get('link-one-a'));
    await userEvent.keyboard('{ArrowUp}{ArrowLeft}');
    expect(document.activeElement).toBe(get('trigger-sub-a'));
  });

  test('the arrow keys reach the links of a nested content in three levels', async () => {
    await mountMenu({
      root: { defaultValue: 'one' },
      nested: { root: { defaultValue: 'sub-a' } },
    });
    await shows('sub-a');
    await placed();
    get('link-sub-a').focus();
    // The content of `sub-a` is a group of its own, with one link.
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(get('link-sub-a'));
    get('trigger-sub-a').focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(get('link-one-b'));
  });

  test('a list moves from the focused trigger after an earlier item leaves, and no part writes tabindex', async () => {
    const items = reactive({ one: true });
    await mountMenu({ items });
    for (const id of ['trigger-one', 'trigger-two', 'link-blog']) {
      expect(get(id)).not.toHaveAttribute('tabindex');
    }
    get('trigger-two').focus();
    items.one = false;
    await nextTick();
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(get('trigger-two'));
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(get('link-blog'));
  });

  test('ArrowRight on a tab in a content keeps the focus in the tab list', async () => {
    mount(TabsInNavigationMenu);
    await nextTick();
    await placed();
    const tabs = await waitFor(() => {
      const found = document.querySelectorAll<HTMLElement>('[role="tab"]');
      expect(found).toHaveLength(2);
      return found;
    });
    tabs[0]!.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(tabs[1]);
  });

  // `RouterLink` is a virtual DOM component, and a Vapor app renders one only with the interop
  // plugin.
  test.skipIf(inject('app') === 'vapor')(
    'ArrowDown moves the focus between two router links in a content',
    async () => {
      mount(NavigationMenuRouterLinks);
      await nextTick();
      await placed();
      const links = await waitFor(() => {
        const found = document.querySelectorAll<HTMLAnchorElement>('[data-testid="popup"] a');
        expect(found).toHaveLength(2);
        return found;
      });
      await waitFor(() => expect(links[0]).toHaveAttribute('aria-current', 'page'));
      expect(links[1]).not.toHaveAttribute('aria-current');
      links[0]!.focus();
      await userEvent.keyboard('{ArrowDown}');
      expect(document.activeElement).toBe(links[1]);
    },
  );
});

describe('the Tab order', () => {
  test('Tab on the active trigger goes into the content; Tab on its last link goes to the next trigger, and the menu stays open', async () => {
    await mountMenu();
    await userEvent.click(get('trigger-one'));
    await shows('one');
    await placed();
    get('trigger-one').focus();
    await tab();
    expect(document.activeElement).toBe(get('link-one-a'));
    await tab(true);
    expect(document.activeElement).toBe(get('trigger-one'));
    await tab();
    await tab();
    expect(document.activeElement).toBe(get('link-one-b'));
    await tab();
    expect(document.activeElement).toBe(get('trigger-two'));
    expect(get('trigger-one')).toHaveAttribute('aria-expanded', 'true');
    await tab(true);
    expect(document.activeElement).toBe(get('link-one-b'));
  });

  test('Tab from the last link out of the root closes the menu with focus-out', async () => {
    const log: string[] = [];
    await mountMenu({ root: rootEvents(log) });
    await userEvent.click(get('trigger-two'));
    await shows('two');
    await placed();
    get('trigger-two').focus();
    await tab();
    expect(document.activeElement).toBe(get('link-two-a'));
    await tab();
    expect(document.activeElement).toBe(get('link-blog'));
    await tab();
    expect(document.activeElement).toBe(byId('after'));
    await closed();
    expect(log.at(-2)).toBe('valueChange null focus-out');
  });

  test('a hover opens the menu, and Tab from the last tab stop of the page does not go into the popup; Shift+Tab into the page does not either', async () => {
    await mountMenu({ root: { delay: 0, closeDelay: 10_000 } });
    await userEvent.hover(get('trigger-one'));
    await shows('one');
    byId('outside').focus();
    await tab();
    expect(get('popup').contains(document.activeElement)).toBe(false);
    await tab();
    expect(get('popup').contains(document.activeElement)).toBe(false);
    byId('outside').focus();
    await tab(true);
    expect(document.activeElement).toBe(byId('after'));
  });

  test('VUE-132: with no viewport, Tab on the active trigger goes to the next tab stop', async () => {
    await mountMenu({ noViewport: true });
    await userEvent.click(get('trigger-one'));
    await opened();
    get('trigger-one').focus();
    await tab();
    expect(document.activeElement).toBe(get('trigger-two'));
  });

  test('in an inline viewport, the content follows its trigger, and a closed nested inline root adds no tab stop', async () => {
    await mountMenu({ inline: true, root: { defaultValue: 'one' }, nested: { root: {} } });
    await shows('one');
    expect(get('nested-viewport').querySelectorAll('[tabindex]')).toHaveLength(0);
    expect(get('viewport').querySelectorAll(':scope > [tabindex="0"]')).toHaveLength(2);
    get('trigger-one').focus();
    await tab();
    expect(document.activeElement).toBe(get('link-one-a'));
    await tab();
    await tab();
    expect(document.activeElement).toBe(get('trigger-sub-a'));
    await tab();
    expect(document.activeElement).toBe(get('trigger-sub-b'));
    await tab();
    expect(document.activeElement).toBe(get('trigger-two'));
    await tab(true);
    expect(document.activeElement).toBe(get('trigger-sub-b'));
    get('link-blog').focus();
    await tab();
    expect(document.activeElement).toBe(byId('after'));
  });
});

describe('the content', () => {
  test('a kept content is hidden in its item while no viewport is there, hidden in the viewport while closed, and the same element moves', async () => {
    await mountMenu({ contents: { one: { keepMounted: true } } });
    const content = get('content-one');
    expect(content).toHaveAttribute('hidden');
    expect(content.parentElement!.localName).toBe('li');
    await userEvent.click(get('trigger-one'));
    await shows('one');
    expect(get('content-one')).toBe(content);
    expect(get('viewport').contains(content)).toBe(true);
    await userEvent.click(get('trigger-two'));
    await waitFor(() => expect(content).toHaveAttribute('hidden'));
    expect(get('viewport').contains(content)).toBe(true);
    await userEvent.click(byId('outside'));
    await closed();
    await waitFor(() => expect(content.parentElement!.localName).toBe('li'));
    expect(content).toHaveAttribute('hidden');
  });

  test('with a kept portal, the closed contents are hidden in the closed popup', async () => {
    await mountMenu({
      portal: { keepMounted: true },
      contents: { one: { keepMounted: true } },
    });
    const popup = await opened();
    expect(popup).toHaveAttribute('hidden');
    await waitFor(() => expect(get('viewport').contains(get('content-one'))).toBe(true));
    expect(get('content-one')).toHaveAttribute('hidden');
    await userEvent.click(get('trigger-one'));
    await shows('one');
    expect(popup).not.toHaveAttribute('hidden');
  });

  test('with `transition`, the new content enters and the old one leaves out of the flow with the new direction; the popup takes the size of the new content', async () => {
    const classes: string[] = [];
    await mountMenu({
      root: { defaultValue: 'one' },
      contents: {
        one: { transition: { name: 'slide' }, class: 'animated' },
        two: { transition: { name: 'slide' }, class: 'animated' },
      },
      popup: { class: 'sized' },
    });
    const old = await shows('one');
    await placed();
    await userEvent.click(get('trigger-two'));
    const next = await shows('two');
    classes.push(next.className, old.className);
    expect(next.className).toContain('slide-enter-active');
    expect(old.className).toContain('slide-leave-active');
    expect(old).toHaveAttribute('data-activation-direction', 'right');
    expect(next).toHaveAttribute('data-activation-direction', 'right');
    expect(old.style.position).toBe('absolute');
    expect(old).toHaveAttribute('inert');
    await waitFor(() => expect(old.isConnected).toBe(false));
    await waitFor(() => expect(get('popup').style.getPropertyValue('--popup-width')).toBe(''));
    expect(get('popup').offsetWidth).toBe(next.offsetWidth);
    expect(get('positioner').style.getPropertyValue('--positioner-width')).toBe(
      `${next.offsetWidth}px`,
    );
  });

  test('the old content with the focus in it is not inert while it leaves', async () => {
    await mountMenu({
      root: { defaultValue: 'one' },
      contents: { one: { transition: { name: 'slide' }, class: 'animated' } },
    });
    const old = await shows('one');
    await placed();
    get('link-one-a').focus();
    get('trigger-two').click();
    await shows('two');
    expect(old.isConnected).toBe(true);
    expect(old.style.position).toBe('absolute');
    expect(old).not.toHaveAttribute('inert');
  });

  test('a content with a CSS transition and no `transition` leaves at once', async () => {
    await mountMenu({ root: { defaultValue: 'one' }, contents: { one: { class: 'animated' } } });
    const old = await shows('one');
    get('trigger-two').click();
    await shows('two');
    expect(old.isConnected).toBe(false);
  });

  test('at a close the content stays in the popup and goes with it; then no content element is in the document', async () => {
    await mountMenu({
      root: { defaultValue: 'one' },
      contents: { one: { transition: { name: 'slide' }, class: 'animated' } },
      popupTransition: { name: 'fade' },
    });
    const content = await shows('one');
    await userEvent.click(byId('outside'));
    await nextTick();
    expect(content.className).not.toContain('slide-leave');
    expect(get('popup').contains(content)).toBe(true);
    await waitFor(() => expect(content.isConnected).toBe(false));
    expect(byTestId('content-one')).toBe(null);
  });

  test('a reopen while the popup leaves shows the new item in a new popup after the leave', async () => {
    await mountMenu({ root: { defaultValue: 'one' }, popupTransition: { name: 'fade' } });
    await shows('one');
    const popup = await opened();
    await userEvent.click(byId('outside'));
    await nextTick();
    get('trigger-two').click();
    await nextTick();
    expect(popup.contains(get('content-one'))).toBe(true);
    await waitFor(() => expect(popup.isConnected).toBe(false));
    const next = await shows('two');
    expect(get('popup')).not.toBe(popup);
    expect(get('popup').contains(next)).toBe(true);
  });

  test('a portal of a nested root goes to the target of the portal of its parent', async () => {
    const container = document.body.appendChild(document.createElement('div'));
    try {
      await mountMenu({
        root: { defaultValue: 'one' },
        portal: { to: container },
        nested: { root: { defaultValue: 'sub-a' }, inline: false },
      });
      await shows('sub-a');
      expect(container.contains(get('nested-positioner'))).toBe(true);
    } finally {
      container.remove();
    }
  });

  test('VUE-60: a scoped style of the developer reaches the element of the `element` slot', async () => {
    mount(NavigationMenuScoped);
    await nextTick();
    const element = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-testid="scoped-content"]');
      expect(found).not.toBe(null);
      return found!;
    });
    expect(getComputedStyle(element).outlineStyle).toBe('dashed');
  });
});

describe('the size', () => {
  test.each([
    { name: 'its item', contents: {} },
    { name: 'its kept item', contents: { a: { keepMounted: true }, b: { keepMounted: true } } },
  ])('the popup follows a nested inline root that changes $name', async ({ contents }) => {
    const { exposed } = await mountMenu({
      root: { defaultValue: 'one' },
      contents: { one: { style: 'height: auto' } },
      nested: { root: { defaultValue: 'sub-a' }, contents },
      popup: { class: 'sized' },
    });
    await shows('sub-a');
    await placed();
    await waitFor(() => expect(get('popup').style.getPropertyValue('--popup-height')).toBe(''));
    const before = get('popup').offsetHeight;
    get('trigger-sub-b').click();
    await shows('sub-b');
    await waitFor(() => expect(get('popup').style.getPropertyValue('--popup-height')).toBe(''));
    expect(get('popup').offsetHeight).toBe(before + 60);
    expect(get('positioner').style.getPropertyValue('--positioner-height')).toBe(
      `${before + 60}px`,
    );
    expect(exposed).toBeDefined();
  });

  test('the popup animates from its old size to the size of the new content', async () => {
    await mountMenu({ root: { defaultValue: 'one' }, popup: { class: 'sized' } });
    await shows('one');
    await placed();
    await waitFor(() => expect(get('popup').getAnimations()).toEqual([]));
    get('trigger-two').click();
    await shows('two');
    await frame();
    expect(get('popup').getAnimations().length).toBeGreaterThan(0);
  });

  test('a close in the steps gives the kept popup no size at the next open', async () => {
    await mountMenu({
      root: { defaultValue: 'one' },
      portal: { keepMounted: true },
      popup: { class: 'sized' },
    });
    await shows('one');
    await placed();
    get('trigger-two').click();
    // The steps start in the update of the change. The close comes before their next step.
    await nextTick();
    get('trigger-two').click();
    await waitFor(() => expect(get('popup')).toHaveAttribute('hidden'));
    await frame();
    get('trigger-two').click();
    await shows('two');
    await placed();
    await frame();
    expect(get('popup').style.getPropertyValue('--popup-width')).toBe('');
    expect(get('popup').offsetWidth).toBe(get('content-two').offsetWidth);
  });

  test('after fast changes the size is that of the last content, and no size variable is zero', async () => {
    await mountMenu({ root: { defaultValue: 'one' }, popup: { class: 'sized' } });
    await shows('one');
    await placed();
    const values: string[] = [];
    const observer = new MutationObserver(() => {
      values.push(get('popup').style.getPropertyValue('--popup-width'));
      values.push(get('positioner').style.getPropertyValue('--positioner-width'));
    });
    observer.observe(get('positioner'), { attributes: true, subtree: true });
    for (let index = 0; index < 10; index += 1) {
      get(index % 2 ? 'trigger-one' : 'trigger-two').click();
      await wait(15);
    }
    await shows('one');
    await waitFor(() => expect(get('popup').style.getPropertyValue('--popup-width')).toBe(''));
    observer.disconnect();
    expect(values).not.toContain('0px');
    expect(get('popup').offsetWidth).toBe(get('content-one').offsetWidth);
  });

  test('the window that changes its size gives the positioner data-instant for 100 ms', async () => {
    await mountMenu({ root: { defaultValue: 'one' } });
    await shows('one');
    await placed();
    await waitFor(() => expect(get('positioner')).not.toHaveAttribute('data-instant'));
    window.dispatchEvent(new Event('resize'));
    await waitFor(() => expect(get('positioner')).toHaveAttribute('data-instant'));
    await waitFor(() => expect(get('positioner')).not.toHaveAttribute('data-instant'));
  });
});

describe('the placement', () => {
  test('the positioner is below the active trigger, placed with insets', async () => {
    await mountMenu({ root: { defaultValue: 'one' }, positioner: { sideOffset: 4 } });
    await shows('one');
    await placed();
    const trigger = get('trigger-one').getBoundingClientRect();
    const place = get('positioner').getBoundingClientRect();
    expect(get('positioner').style.top).toMatch(/px$/);
    expect(get('positioner')).toHaveAttribute('data-side', 'bottom');
    expect(Math.round(place.top)).toBe(Math.round(trigger.bottom + 4));
  });

  test.each(['top', 'left'] as const)(
    'with the side `%s`, the edge of the popup at the trigger stays at its place while the size changes',
    async (side) => {
      await mountMenu({
        root: { defaultValue: 'one' },
        list: {
          style:
            'display: flex; flex-direction: column; gap: 8px; margin: 300px 0 0 400px; padding: 0; list-style: none',
        },
        positioner: {
          side,
          sideOffset: 4,
          collisionAvoidance: { side: 'none' },
          // The CSS of the demos: the positioner has the size of the new content.
          style: 'width: var(--positioner-width); height: var(--positioner-height)',
        },
        popup: { class: 'sized' },
      });
      await shows('one');
      await placed();
      const edge = () => {
        const box = get('popup').getBoundingClientRect();
        return Math.round(side === 'top' ? box.bottom : box.right);
      };
      const near = (trigger: string) => {
        const box = get(trigger).getBoundingClientRect();
        return Math.round((side === 'top' ? box.top : box.left) - 4);
      };
      expect(edge()).toBe(near('trigger-one'));
      // The popup at rest, so that its size animates at the change.
      await wait(200);
      get('trigger-two').click();
      const edges: number[] = [];
      for (let index = 0; index < 8; index += 1) {
        await frame();
        edges.push(edge());
      }
      await waitFor(() => expect(get('popup').style.getPropertyValue('--popup-height')).toBe(''));
      expect(new Set(edges).size).toBeLessThanOrEqual(2);
      expect(Math.abs(edges.at(-1)! - near('trigger-two'))).toBeLessThanOrEqual(1);
      expect(get('popup').offsetWidth).toBe(get('content-two').offsetWidth);
    },
  );

  test('the shift keeps the popup in the layout viewport, so a pinch zoom does not move it', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'visualViewport')!;
    // A visual viewport of a pinch zoom: a part of the layout viewport at its top left.
    const visual = { width: 200, height: 300, offsetLeft: 0, offsetTop: 0, scale: 2 };
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: Object.assign(new EventTarget(), visual),
    });
    onTestFinished(() => {
      Object.defineProperty(window, 'visualViewport', descriptor);
    });
    await mountMenu({
      root: { defaultValue: 'one' },
      list: { style: 'display: flex; margin: 0 0 0 250px; padding: 0; list-style: none' },
    });
    await shows('one');
    await placed();
    // With the visual viewport as its boundary, the shift would move the popup to its left edge.
    expect(get('popup').getBoundingClientRect().left).toBeGreaterThan(100);
  });

  test('a nested positioner takes a side of the other axis when neither side of its axis has room', async () => {
    await mountMenu({
      root: { defaultValue: 'one' },
      contents: { one: { style: 'height: auto' } },
      nested: {
        root: { defaultValue: 'sub-a' },
        inline: false,
        contents: { a: { style: 'width: 95vw; height: 40px' } },
      },
    });
    await waitFor(() => expect(byTestId('content-sub-a')).not.toBe(null));
    await waitFor(() => expect(get('nested-positioner').style.visibility).toBe(''));
    expect(get('nested-positioner')).toHaveAttribute('data-side', 'bottom');
  });

  test('a top-level positioner keeps its side when neither side of the axis has room; with `fallbackAxisSide` it takes the other axis', async () => {
    const setup = (positioner: Props) => ({
      root: { defaultValue: 'one' },
      list: { style: 'display: flex; margin: 45vh 0 0 40px; padding: 0; list-style: none' },
      contents: { one: { style: 'width: 200px; height: 80vh' } },
      positioner,
    });
    const first = await mountMenu(setup({}));
    await shows('one');
    await placed();
    expect(get('positioner')).toHaveAttribute('data-side', 'bottom');
    first.unmount();
    await mountMenu(setup({ collisionAvoidance: { fallbackAxisSide: 'end' } }));
    await shows('one');
    await placed();
    expect(get('positioner')).toHaveAttribute('data-side', 'right');
  });

  test('VUE-105, VUE-109: the popup has the id of the shown trigger in aria-labelledby, also an id of the developer', async () => {
    await mountMenu({ root: { defaultValue: 'one' }, triggers: { two: { id: 'given' } } });
    await shows('one');
    expect(get('popup')).toHaveAttribute('aria-labelledby', get('trigger-one').id);
    await userEvent.click(get('trigger-two'));
    await shows('two');
    expect(get('popup')).toHaveAttribute('aria-labelledby', 'given');
    expect(get('trigger-two').id).toBe('given');
  });

  test('VUE-105: an aria-label of the developer takes the place of the name of the trigger', async () => {
    await mountMenu({ root: { defaultValue: 'one' }, popup: { 'aria-label': 'Main' } });
    await shows('one');
    expect(get('popup')).not.toHaveAttribute('aria-labelledby');
  });
});

describe('nested roots', () => {
  test('a hover opens a nested inline item, and a close of the parent closes it with the popup', async () => {
    await mountMenu({ root: { defaultValue: 'one', delay: 0 }, nested: { root: { delay: 0 } } });
    await shows('one');
    await userEvent.hover(get('trigger-sub-b'));
    await shows('sub-b');
    expect(get('nested-viewport').contains(get('content-sub-b'))).toBe(true);
    await userEvent.hover(get('trigger-sub-a'));
    await shows('sub-a');
    await userEvent.click(byId('outside'));
    await closed();
  });

  test('a link with closeOnClick closes each level, each with its own valueChange', async () => {
    const outer: string[] = [];
    const inner: string[] = [];
    await mountMenu({
      root: rootEvents(outer, { defaultValue: 'one' }),
      nested: { root: rootEvents(inner, { defaultValue: 'sub-a' }) },
    });
    await shows('sub-a');
    await userEvent.click(get('link-sub-a'));
    await closed();
    expect(inner).toEqual(['valueChange null link-press', 'update null']);
    expect(outer).toEqual(['valueChange null link-press', 'update null']);
  });

  test('the icon of the open item has data-popup-open', async () => {
    await mountMenu({ root: { defaultValue: 'one' } });
    await shows('one');
    expect(get('icon-one')).toHaveAttribute('data-popup-open');
    await userEvent.click(get('trigger-two'));
    await waitFor(() => expect(get('icon-one')).not.toHaveAttribute('data-popup-open'));
  });
});

describe('a popover in a content', () => {
  test('a press in the popover keeps the menu open: the popover is a layer above it', async () => {
    mount(NavigationMenuWithDialog);
    await nextTick();
    await userEvent.click(get('trigger'));
    await waitFor(() => expect(byTestId('content')).not.toBe(null));
    await placed();
    await userEvent.click(get('popover-trigger'));
    await waitFor(() => expect(byTestId('popover-popup')).not.toBe(null));
    await userEvent.click(get('popover-button'));
    await wait(50);
    expect(get('trigger')).toHaveAttribute('aria-expanded', 'true');
    expect(byTestId('popover-popup')).not.toBe(null);
  });
});

// Dialog is on the older popup layer, so the menu takes the dialog as outside. The change that moves
// Dialog to `src/popup/` makes it a layer above the menu, and these cases run again.
describe.skip('a dialog in a content', () => {
  test('a press on the trigger of the dialog in a menu that a hover opened keeps the menu open', async () => {
    mount(NavigationMenuWithDialog);
    await nextTick();
    await userEvent.hover(get('trigger'));
    await waitFor(() => expect(byTestId('content')).not.toBe(null));
    await placed();
    await userEvent.click(get('dialog-trigger'));
    await waitFor(() => expect(byTestId('dialog-popup')).not.toBe(null));
    await wait(50);
    expect(get('trigger')).toHaveAttribute('aria-expanded', 'true');
  });

  test('a press in the dialog keeps the menu open', async () => {
    mount(NavigationMenuWithDialog);
    await nextTick();
    await userEvent.click(get('trigger'));
    await waitFor(() => expect(byTestId('content')).not.toBe(null));
    await placed();
    await userEvent.click(get('dialog-trigger'));
    await waitFor(() => expect(byTestId('dialog-popup')).not.toBe(null));
    await userEvent.click(get('dialog-button'));
    await wait(50);
    expect(get('trigger')).toHaveAttribute('aria-expanded', 'true');
  });
});

// The case throws in `setup`, so it is the last of the file.
describe('a part outside its parent', () => {
  test('throws an error that names the part and its parent', () => {
    expect(String(mountError(NavigationMenuPartAlone, { part: 'List' }))).toContain(
      '<NavigationMenu.List> must be inside <NavigationMenu.Root>',
    );
    expect(String(mountError(NavigationMenuPartAlone, { part: 'Icon', inRoot: true }))).toContain(
      '<NavigationMenu.Icon> must be inside <NavigationMenu.Item>',
    );
    expect(
      String(mountError(NavigationMenuPartAlone, { part: 'Positioner', inRoot: true })),
    ).toContain('<NavigationMenu.Positioner> must be inside <NavigationMenu.Portal>');
    expect(String(mountError(NavigationMenuPartAlone, { part: 'Arrow', inRoot: true }))).toContain(
      '<NavigationMenu.Arrow> must be inside <NavigationMenu.Positioner>',
    );
    takeReportedMessages();
  });
});
