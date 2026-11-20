import { describe, expect, inject, onTestFinished, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import { Dialog, type DialogRootChangeEventDetails } from '@vase-ui/vue/dialog';
import DialogHandles from '../../test/fixtures/DialogHandles.vue';
import DialogInTransition from '../../test/fixtures/DialogInTransition.vue';
import DialogPages from '../../test/fixtures/DialogPages.vue';
import DialogPartAlone from '../../test/fixtures/DialogPartAlone.vue';
import DialogParts from '../../test/fixtures/DialogParts.vue';
import DialogSiblings from '../../test/fixtures/DialogSiblings.vue';
import { isScrollLocked } from '../../test/fixtures/scrollDocument';
import { touchDrag } from '../../test/pointer';
import { mount, mountError } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const popup = () => byTestId('popup');
const byId = (id: string) => document.getElementById(id)!;
// The fixed element of a modal dialog.
const BLOCK = 'body > div[role="presentation"]:not([data-testid])';
const block = () => document.querySelector<HTMLElement>(BLOCK);
const inert = (element: Element) => element.closest('[inert]') !== null;
const hidden = (element: Element) => element.closest('[aria-hidden="true"]') !== null;

async function mountDialog(setup: Props = {}) {
  const { root, exposed, unmount } = mount(DialogParts, setup);
  await nextTick();
  const trigger = (key = 't') => root.querySelector<HTMLElement>(`[data-key="${key}"]`)!;
  return { root, exposed, unmount, trigger };
}

/** Props of a root that write each event in `log`. */
function rootEvents(log: string[], props: Props = {}) {
  return reactive<Props>({
    ...props,
    onOpenChange: (open: boolean, details: DialogRootChangeEventDetails) =>
      log.push(`openChange ${open} ${details.reason}`),
    'onUpdate:open': (open: boolean) => log.push(`update ${open}`),
  });
}

async function opened(id = 'popup') {
  await waitFor(() => expect(byTestId(id)).not.toBe(null));
  return byTestId(id)!;
}

async function closed(id = 'popup') {
  await waitFor(() => expect(byTestId(id)).toBe(null));
}

function centerOf(element: Element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** A real mouse press at the center of the element, on what is there. */
async function press(element: Element) {
  await userEvent.pointer({ coords: centerOf(element), keys: '[MouseLeft]' });
}

/** Appends an element to `<body>`. It goes away at the end of the case. */
function append<K extends keyof HTMLElementTagNameMap>(tag: K, style = '') {
  const element = document.body.appendChild(document.createElement(tag));
  element.style.cssText = style;
  onTestFinished(() => element.remove());
  return element;
}

describe('the parts', () => {
  test('render their native elements with their roles in <body>; a template ref has element; the attributes of the developer win', async () => {
    const { trigger, exposed } = await mountDialog({
      root: { defaultOpen: true },
      triggers: [{ key: 't', attrs: { type: 'submit' } }],
      backdrop: {},
      viewport: {},
      popup: { role: 'alertdialog' },
      title: {},
      description: {},
      close: { type: 'reset' },
    });
    const element = await opened();
    expect(trigger().localName).toBe('button');
    expect(trigger()).toHaveAttribute('type', 'submit');
    expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(element.localName).toBe('div');
    expect(element).toHaveAttribute('role', 'alertdialog');
    expect(element).toHaveAttribute('tabindex', '-1');
    expect(exposed.popup.element).toBe(element);
    expect(byTestId('viewport')!.parentElement).toBe(document.body);
    expect(byTestId('viewport')).toHaveAttribute('role', 'presentation');
    expect(byTestId('backdrop')).toHaveAttribute('role', 'presentation');
    expect(element.querySelector('h2')).toHaveTextContent('Title');
    expect(element.querySelector('p')).toHaveTextContent('Description');
    expect(element.querySelector('button[type="reset"]')).toHaveTextContent('Close');
  });

  test('render the tag of `as`', async () => {
    const { trigger } = await mountDialog({
      root: { defaultOpen: true },
      triggers: [{ key: 't', attrs: { as: 'span' } }],
      popup: { as: 'section' },
      close: { as: 'span', 'data-testid': 'close' },
    });
    const element = await opened();
    expect(trigger().localName).toBe('span');
    expect(trigger()).toHaveAttribute('role', 'button');
    expect(trigger()).not.toHaveAttribute('type');
    expect(element.localName).toBe('section');
    expect(byTestId('close')).toHaveAttribute('role', 'button');
  });

  test.each([
    {
      part: 'Popup',
      inRoot: false,
      message:
        'Vase UI: <Dialog.Popup> must be inside <Dialog.Root> or <AlertDialog.Root>. Without a root the part has no dialog. Put the part inside <Dialog.Root> or <AlertDialog.Root>.',
    },
    {
      part: 'Trigger',
      inRoot: false,
      message:
        'Vase UI: <Dialog.Trigger> must be inside <Dialog.Root>, or it must have a `handle`. Without a root the trigger has no dialog to open. Put the trigger inside <Dialog.Root>, or pass a `handle`.',
    },
    ...['Backdrop', 'Viewport', 'Popup'].map((part) => ({
      part,
      inRoot: true,
      message: `Vase UI: <Dialog.${part}> must be inside <Dialog.Portal>. Without the portal the part is not above the page. Put the part inside <Dialog.Portal>.`,
    })),
  ])('$part throws an error with no root, or with no portal: inRoot=$inRoot', ({ part, inRoot, message }) => {
    const error = mountError(DialogPartAlone, { part, inRoot });
    expect((error as Error).message).toBe(message);
  });
});

describe('the root', () => {
  test('a press on the trigger opens; Close closes with `close-press`; openChange comes before update:open, and details.trigger is the trigger', async () => {
    const log: string[] = [];
    const triggers: (Element | undefined)[] = [];
    const root = {
      onOpenChange: (open: boolean, details: DialogRootChangeEventDetails) => {
        log.push(`openChange ${open} ${details.reason}`);
        triggers.push(details.trigger);
      },
      'onUpdate:open': (open: boolean) => log.push(`update ${open}`),
    };
    const { trigger } = await mountDialog({ root, close: { 'data-testid': 'close' } });
    await userEvent.click(trigger());
    await opened();
    await userEvent.click(byTestId('close')!);
    await closed();
    expect(log).toEqual([
      'openChange true trigger-press',
      'update true',
      'openChange false close-press',
      'update false',
    ]);
    expect(triggers).toEqual([trigger(), trigger()]);
  });

  test('a controlled root shows only the value of its parent; cancel() keeps the state; a change by the parent and a mount open emit nothing', async () => {
    const log: string[] = [];
    const root = rootEvents(log, { open: true });
    const { trigger } = await mountDialog({ root, close: {} });
    await opened();
    await userEvent.keyboard('{Escape}');
    expect(log).toEqual(['openChange false escape-key', 'update false']);
    expect(popup()).not.toBe(null);
    root.open = false;
    await closed();
    root.onOpenChange = (open: boolean, details: DialogRootChangeEventDetails) => {
      log.push(`openChange ${open} ${details.reason}`);
      details.cancel();
    };
    await userEvent.click(trigger());
    await nextTick();
    expect(popup()).toBe(null);
    expect(log).toEqual(['openChange false escape-key', 'update false', 'openChange true trigger-press']);
  });

  test('one cancel() gives one openChange for one Escape, and the dialog stays', async () => {
    const log: string[] = [];
    const root = {
      defaultOpen: true,
      onOpenChange: (open: boolean, details: DialogRootChangeEventDetails) => {
        log.push(`openChange ${open} ${details.reason}`);
        details.cancel();
      },
    };
    await mountDialog({ root });
    await opened();
    await waitFor(() => expect(byTestId('field')).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    expect(log).toEqual(['openChange false escape-key']);
    expect(popup()).not.toBe(null);
  });

  test('the close() of a template ref asks for a close with `imperative-action`; with a `defaultTriggerId` that no trigger has, details.trigger is undefined', async () => {
    const triggers: unknown[] = [];
    const log: string[] = [];
    const { exposed } = await mountDialog({
      root: {
        defaultOpen: true,
        defaultTriggerId: 'missing',
        onOpenChange: (open: boolean, details: DialogRootChangeEventDetails) => {
          log.push(`openChange ${open} ${details.reason}`);
          triggers.push(details.trigger);
        },
      },
      triggers: [],
    });
    await opened();
    exposed.root.close();
    await closed();
    expect(log).toEqual(['openChange false imperative-action']);
    expect(triggers).toEqual([undefined]);
  });

  test('with more triggers, a press moves the dialog to its trigger; v-model:trigger-id follows; the slot gets the payload; the reason of Escape names that trigger', async () => {
    const ids: (string | null)[] = [];
    const reasons: [string, Element | undefined][] = [];
    const { trigger } = await mountDialog({
      root: {
        modal: false,
        'onUpdate:triggerId': (id: string | null) => ids.push(id),
        onOpenChange: (_: boolean, details: DialogRootChangeEventDetails) =>
          reasons.push([details.reason, details.trigger]),
      },
      triggers: [
        { key: 'a', attrs: { id: 'a', payload: 'A' } },
        { key: 'b', attrs: { id: 'b', payload: 'B' } },
      ],
    });
    await userEvent.click(trigger('a'));
    await opened();
    expect(byTestId('payload')).toHaveTextContent('A');
    expect(trigger('a')).toHaveAttribute('aria-expanded', 'true');
    expect(trigger('a')).toHaveAttribute('aria-controls', popup()!.id);
    await userEvent.click(trigger('b'));
    await waitFor(() => expect(byTestId('payload')).toHaveTextContent('B'));
    expect(trigger('a')).toHaveAttribute('aria-expanded', 'false');
    expect(trigger('a')).not.toHaveAttribute('aria-controls');
    expect(trigger('b')).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(ids).toEqual(['a', 'b']);
    expect(reasons).toEqual([
      ['trigger-press', trigger('a')],
      ['trigger-press', trigger('b')],
      ['escape-key', trigger('b')],
    ]);
  });

  test('keeps its active trigger when another trigger mounts while it is open', async () => {
    const triggers = reactive([{ key: 'a', attrs: { id: 'a' } }]);
    const { trigger } = await mountDialog({ root: { modal: false }, triggers });
    await userEvent.click(trigger('a'));
    const element = await opened();
    triggers.push({ key: 'b', attrs: { id: 'b' } });
    await nextTick();
    expect(trigger('a')).toHaveAttribute('aria-expanded', 'true');
    expect(trigger('a')).toHaveAttribute('aria-controls', element.id);
    expect(trigger('b')).toHaveAttribute('aria-expanded', 'false');
    expect(trigger('b')).not.toHaveAttribute('aria-controls');
  });

  test('a click of a press that started before the open closes nothing; the next press closes', async () => {
    const log: string[] = [];
    const root = rootEvents(log, { open: false });
    const opener = append('button', 'position: fixed; left: 0; top: 0; width: 100px; height: 40px');
    opener.addEventListener('pointerdown', () => (root.open = true));
    root['onUpdate:open'] = (open: boolean) => {
      log.push(`update ${open}`);
      root.open = open;
    };
    await mountDialog({ root, backdrop: { style: 'position: fixed; inset: 0' } });
    const point = centerOf(opener);
    await userEvent.pointer([{ coords: point }, '[MouseLeft>]']);
    await opened();
    await userEvent.pointer('[/MouseLeft]');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(popup()).not.toBe(null);
    expect(log).toEqual([]);
    await userEvent.pointer({ coords: point, keys: '[MouseLeft]' });
    await closed();
    expect(log).toEqual(['openChange false outside-press', 'update false']);
  });
});

describe('the handle', () => {
  test('connects triggers outside the root; open(id) opens for that trigger; isOpen and close() follow; the payload goes to the slot', async () => {
    const handle = Dialog.createHandle<string>();
    const { root } = mount(DialogHandles, { handle });
    await nextTick();
    const first = root.querySelector<HTMLElement>('#first')!;
    expect(handle.isOpen).toBe(false);
    await userEvent.click(first);
    await opened();
    expect(byTestId('payload')).toHaveTextContent('first');
    expect(first).toHaveAttribute('aria-expanded', 'true');
    expect(handle.isOpen).toBe(true);
    handle.close();
    await closed();
    handle.open('second');
    await opened();
    expect(byTestId('payload')).toHaveTextContent('second');
    expect(root.querySelector('#second')).toHaveAttribute('aria-expanded', 'true');
  });

  test.each([
    { name: 'open(null)', open: (handle: Dialog.Handle<string>) => handle.open(null) },
    { name: 'open() of an unknown id', open: (handle: Dialog.Handle<string>) => handle.open('x') },
  ])('$name opens with no active trigger, also when the root has one trigger', async ({ open }) => {
    const handle = Dialog.createHandle<string>();
    const triggers: unknown[] = [];
    const { root } = mount(DialogHandles, {
      handle,
      root: {
        onOpenChange: (_: boolean, details: DialogRootChangeEventDetails) =>
          triggers.push(details.trigger),
      },
    });
    await nextTick();
    open(handle);
    await opened();
    expect(triggers).toEqual([undefined]);
    for (const trigger of root.querySelectorAll('button')) {
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    }
  });

  test('openWithPayload() opens with no trigger; its payload stays until the next open by a trigger, also after a refused close and a trigger that mounts', async () => {
    const handle = Dialog.createHandle<string>();
    const scene = reactive({ inside: false });
    const refuse = { close: false };
    const { root } = mount(DialogHandles, {
      handle,
      scene,
      root: {
        onOpenChange: (open: boolean, details: DialogRootChangeEventDetails) => {
          if (!open && refuse.close) details.cancel();
        },
      },
    });
    await nextTick();
    handle.openWithPayload('given');
    await opened();
    expect(byTestId('payload')).toHaveTextContent('given');
    scene.inside = true;
    await nextTick();
    expect(root.querySelector('#inside')).toHaveAttribute('aria-expanded', 'false');
    expect(byTestId('payload')).toHaveTextContent('given');
    refuse.close = true;
    await userEvent.keyboard('{Escape}');
    expect(byTestId('payload')).toHaveTextContent('given');
    refuse.close = false;
    handle.close();
    await closed();
    await userEvent.click(root.querySelector<HTMLElement>('#first')!);
    await opened();
    expect(byTestId('payload')).toHaveTextContent('first');
  });

  test('with no root, the methods and the triggers do nothing; a root that mounts again starts closed with no payload', async () => {
    const handle = Dialog.createHandle<string>();
    const scene = reactive({ root: false });
    const { root } = mount(DialogHandles, { handle, scene });
    await nextTick();
    handle.open(null);
    handle.openWithPayload('given');
    handle.close();
    await userEvent.click(root.querySelector<HTMLElement>('#first')!);
    await nextTick();
    expect(handle.isOpen).toBe(false);
    expect(popup()).toBe(null);
    scene.root = true;
    await nextTick();
    handle.openWithPayload('given');
    await opened();
    scene.root = false;
    await closed();
    expect(handle.isOpen).toBe(false);
    scene.root = true;
    await nextTick();
    expect(handle.isOpen).toBe(false);
    expect(byTestId('root-payload')).toHaveTextContent('');
  });

  test.each([
    {
      name: 'opens',
      root: {},
      call: (handle: Dialog.Handle<string>) => handle.openWithPayload('at mount'),
      open: true,
    },
    {
      name: 'closes',
      root: { defaultOpen: true },
      call: (handle: Dialog.Handle<string>) => handle.close(),
      open: false,
    },
  ])('a child of the root $name the dialog in its `onMounted`', async ({ root, call, open }) => {
    const handle = Dialog.createHandle<string>();
    mount(DialogHandles, { handle, root, atMount: () => call(handle) });
    await nextTick();
    await nextTick();
    expect(handle.isOpen).toBe(open);
    if (open) expect((await opened()).textContent).toContain('at mount');
  });

  test('a root that gets the handle after its mount takes it; a root that loses it releases it', async () => {
    const handle = Dialog.createHandle();
    const root = reactive<Props>({});
    await mountDialog({ root });
    handle.open(null);
    await nextTick();
    expect(popup()).toBe(null);
    root.handle = handle;
    await nextTick();
    handle.open(null);
    await opened();
    handle.close();
    await closed();
    root.handle = undefined;
    await nextTick();
    handle.open(null);
    await nextTick();
    expect(popup()).toBe(null);
  });

  // Vue 3.6 runs no `<Suspense>` in a Vapor app with Vapor parts.
  test.skipIf(inject('app') === 'vapor')(
    'a <Suspense> that replaces a page by a page with the same handle gives the handle to the new page',
    async () => {
      const handle = Dialog.createHandle();
      const scene = reactive({ page: 'a' });
      const { root } = mount(DialogPages, { handle, scene });
      await nextTick();
      scene.page = 'b';
      for (let tick = 0; tick < 4; tick += 1) await nextTick();
      await userEvent.click(root.querySelector('button')!);
      await opened('popup-b');
      handle.close();
      await closed('popup-b');
      handle.open(null);
      await opened('popup-b');
      expect(byTestId('popup-a')).toBe(null);
    },
  );
});
