import { describe, expect, inject, onTestFinished, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import { Dialog, type DialogRootChangeEventDetails } from '@vase-ui/vue/dialog';
import DialogConfirm from '../../test/fixtures/DialogConfirm.vue';
import DialogHandles from '../../test/fixtures/DialogHandles.vue';
import DialogInTransition from '../../test/fixtures/DialogInTransition.vue';
import DialogPages from '../../test/fixtures/DialogPages.vue';
import DialogPartAlone from '../../test/fixtures/DialogPartAlone.vue';
import DialogParts from '../../test/fixtures/DialogParts.vue';
import DialogRadioReturn from '../../test/fixtures/DialogRadioReturn.vue';
import DialogSiblings from '../../test/fixtures/DialogSiblings.vue';
import DialogWithScrub from '../../test/fixtures/DialogWithScrub.vue';
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

describe('modal', () => {
  test('`true` makes the rest of the page and the trigger inert, renders a fixed element with no hole, locks the scroll and makes the popup aria-modal', async () => {
    const { trigger } = await mountDialog({ root: { defaultOpen: true } });
    const element = await opened();
    await waitFor(() => expect(inert(byId('before'))).toBe(true));
    expect(inert(trigger())).toBe(true);
    expect(inert(element)).toBe(false);
    expect(block()!.style.position).toBe('fixed');
    expect(block()!.style.clipPath).toBe('');
    expect(element).toHaveAttribute('aria-modal', 'true');
    await waitFor(() => expect(isScrollLocked()).toBe(true));
  });

  test("`'trap-focus'` hides the rest of the page and the trigger with aria-hidden; the page stays in use, with no lock; a press on the trigger closes", async () => {
    const log: string[] = [];
    const { trigger } = await mountDialog({ root: rootEvents(log, { modal: 'trap-focus' }) });
    await userEvent.click(trigger());
    const element = await opened();
    await waitFor(() => expect(hidden(byId('before'))).toBe(true));
    expect(hidden(trigger())).toBe(true);
    expect(inert(byId('before'))).toBe(false);
    expect(element).not.toHaveAttribute('aria-modal');
    expect(block()).toBe(null);
    expect(isScrollLocked()).toBe(false);
    await userEvent.click(trigger());
    await closed();
    expect(log).toEqual([
      'openChange true trigger-press',
      'update true',
      'openChange false trigger-press',
      'update false',
    ]);
  });

  test('`false` leaves the page and the trigger in use; a press on the trigger closes', async () => {
    const log: string[] = [];
    const { trigger } = await mountDialog({ root: rootEvents(log, { modal: false }) });
    await userEvent.click(trigger());
    const element = await opened();
    await nextTick();
    expect(inert(byId('before')) || hidden(byId('before'))).toBe(false);
    expect(element).not.toHaveAttribute('aria-modal');
    expect(block()).toBe(null);
    expect(isScrollLocked()).toBe(false);
    await userEvent.click(trigger());
    await closed();
    expect(log.at(-2)).toBe('openChange false trigger-press');
  });

  test.each([
    { modal: true, trap: true },
    { modal: 'trap-focus', trap: true },
    { modal: false, trap: false },
  ])(
    'with modal=$modal, the focus stays in the popup=$trap; else Shift+Tab goes to the trigger, and Tab on it goes back into the popup',
    async ({ modal, trap }) => {
      const { trigger } = await mountDialog({ root: { defaultOpen: true, modal } });
      await opened();
      await waitFor(() => expect(byTestId('field')).toHaveFocus());
      await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
      expect(trap ? byTestId('button') : trigger()).toHaveFocus();
      await userEvent.keyboard('{Tab}');
      expect(byTestId('field')).toHaveFocus();
      expect(popup()).not.toBe(null);
    },
  );

  test('a dialog that is not modal closes with `focus-out` when Tab leaves it, and the focus goes to the element after the trigger', async () => {
    const log: string[] = [];
    const { trigger } = await mountDialog({ root: rootEvents(log, { modal: false }) });
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(byTestId('field')).toHaveFocus());
    await userEvent.keyboard('{Tab}{Tab}');
    await closed();
    expect(byId('after')).toHaveFocus();
    expect(log.at(-2)).toBe('openChange false focus-out');
  });

  test('with disablePointerDismissal, a dialog that is not modal stays open when the focus leaves; Tab on the trigger goes back into the popup', async () => {
    const { trigger } = await mountDialog({
      root: { modal: false, disablePointerDismissal: true },
    });
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(byTestId('field')).toHaveFocus());
    await userEvent.keyboard('{Tab}{Tab}');
    expect(byId('after')).toHaveFocus();
    expect(popup()).not.toBe(null);
    await userEvent.click(byId('outside'));
    expect(popup()).not.toBe(null);
    trigger().focus();
    await userEvent.keyboard('{Tab}');
    expect(byTestId('field')).toHaveFocus();
  });

  test.each([
    { modal: true, backdrop: false, at: 'click' },
    { modal: 'trap-focus', backdrop: false, at: 'pointerdown' },
    { modal: 'trap-focus', backdrop: true, at: 'click' },
    { modal: false, backdrop: false, at: 'click' },
    { modal: false, backdrop: true, at: 'click' },
  ])(
    'an outside mouse press with modal=$modal and a backdrop=$backdrop closes at $at',
    async ({ modal, backdrop, at }) => {
      const reasons: string[] = [];
      await mountDialog({
        root: {
          defaultOpen: true,
          modal,
          onOpenChange: (_: boolean, details: DialogRootChangeEventDetails) =>
            reasons.push(`${details.reason} ${details.event.type}`),
        },
        backdrop: backdrop ? { style: 'position: fixed; inset: 0' } : undefined,
      });
      await opened();
      await userEvent.pointer([{ coords: centerOf(byId('outside')) }, '[MouseLeft>]']);
      await nextTick();
      expect(popup() === null).toBe(at === 'pointerdown');
      await userEvent.pointer('[/MouseLeft]');
      await closed();
      expect(reasons).toEqual([`outside-press ${at}`]);
    },
  );

  test('a change of modal while the dialog is open applies at once and emits nothing', async () => {
    const log: string[] = [];
    const root = rootEvents(log, { defaultOpen: true, modal: true });
    await mountDialog({ root });
    const element = await opened();
    await waitFor(() => expect(inert(byId('before'))).toBe(true));
    root.modal = 'trap-focus';
    await waitFor(() => expect(hidden(byId('before'))).toBe(true));
    expect(inert(byId('before'))).toBe(false);
    expect(block()).toBe(null);
    expect(isScrollLocked()).toBe(false);
    expect(element).not.toHaveAttribute('aria-modal');
    root.modal = false;
    await waitFor(() => expect(hidden(byId('before'))).toBe(false));
    root.modal = true;
    await waitFor(() => expect(inert(byId('before'))).toBe(true));
    expect(block()).not.toBe(null);
    expect(element).toHaveAttribute('aria-modal', 'true');
    expect(log).toEqual([]);
  });

  describe.skipIf(server.browser !== 'chromium')('a touch outside', () => {
    async function touchDialog(modal: boolean | 'trap-focus', backdrop: boolean) {
      const reasons: string[] = [];
      await mountDialog({
        root: {
          defaultOpen: true,
          modal,
          onOpenChange: (_: boolean, details: DialogRootChangeEventDetails) =>
            reasons.push(`${details.reason} ${details.event.type}`),
        },
        popup: { initialFocus: false },
        backdrop: backdrop ? { style: 'position: fixed; inset: 0; touch-action: none' } : undefined,
      });
      await opened();
      return reasons;
    }
    const point = { x: 60, y: 300 };
    const surface = 'position: fixed; left: 0; top: 200px; width: 150px; height: 200px; touch-action: none';

    test.each([
      { modal: true, backdrop: false },
      { modal: 'trap-focus', backdrop: true },
      { modal: false, backdrop: true },
    ] as const)(
      'with modal=$modal and a backdrop=$backdrop closes at the `click` of a tap, and not at a drag',
      async ({ modal, backdrop }) => {
        append('div', surface);
        const reasons = await touchDialog(modal, backdrop);
        await touchDrag(point, { x: point.x + 40, y: point.y }, 4);
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(popup()).not.toBe(null);
        await touchDrag(point, point, 0);
        await closed();
        expect(reasons).toEqual(['outside-press click']);
      },
    );

    test.each(['trap-focus', false] as const)(
      'with modal=%s and no backdrop closes at a drag',
      async (modal) => {
        append('div', surface);
        const reasons = await touchDialog(modal, false);
        await touchDrag(point, { x: point.x + 40, y: point.y }, 4);
        await closed();
        expect(reasons).toEqual(['outside-press pointermove']);
      },
    );

    test('a pinch closes nothing', async () => {
      append('div', surface);
      await touchDialog(false, false);
      const { cdp } = await import('vitest/browser');
      const session = cdp();
      const frame = window.frameElement!.getBoundingClientRect();
      const scale = frame.width / window.innerWidth || 1;
      const at = (x: number, y: number) => ({ x: frame.left + x * scale, y: frame.top + y * scale });
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [at(60, 250)],
      });
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [at(60, 250), at(100, 350)],
      });
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [at(60, 230), at(100, 380)],
      });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(popup()).not.toBe(null);
    });
  });
});

describe('the dismissal', () => {
  test('Escape closes the top dialog first: one Escape for each of three sibling dialogs that open at the mount', async () => {
    mount(DialogSiblings, {
      dialogs: [0, 1, 2].map(() => ({ root: { defaultOpen: true }, popup: { initialFocus: false } })),
    });
    await opened('popup-2');
    for (const index of [2, 1, 0]) {
      expect(byTestId(`popup-${index}`)).not.toBe(null);
      await userEvent.keyboard('{Escape}');
      await closed(`popup-${index}`);
    }
  });

  test('a press closes one dialog: the top one of two sibling modal dialogs, then the one below', async () => {
    const scene = reactive({ open: { 0: true } as Record<number, boolean> });
    mount(DialogSiblings, { dialogs: [{}, {}], scene });
    await opened('popup-0');
    await userEvent.click(byTestId('next-0')!);
    await opened('popup-1');
    await press(byId('outside'));
    await closed('popup-1');
    expect(byTestId('popup-0')).not.toBe(null);
    await press(byId('outside'));
    await closed('popup-0');
  });

  test("a press outside a `'trap-focus'` dialog above a dialog that is not modal closes only the top one", async () => {
    const scene = reactive({ open: { 0: true } as Record<number, boolean> });
    mount(DialogSiblings, {
      dialogs: [{ root: { modal: false } }, { root: { modal: 'trap-focus' } }],
      scene,
    });
    await opened('popup-0');
    await userEvent.click(byTestId('next-0')!);
    await opened('popup-1');
    await press(byId('outside'));
    await closed('popup-1');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(byTestId('popup-0')).not.toBe(null);
    await press(byId('outside'));
    await closed('popup-0');
  });

  test('a press on the fixed element, on a backdrop and on the viewport closes with `outside-press`; a press in the popup closes nothing', async () => {
    for (const part of ['block', 'backdrop', 'viewport'] as const) {
      const reasons: string[] = [];
      const { unmount } = await mountDialog({
        root: {
          defaultOpen: true,
          onOpenChange: (_: boolean, details: DialogRootChangeEventDetails) =>
            reasons.push(details.reason),
        },
        backdrop: part === 'backdrop' ? { style: 'position: fixed; inset: 0' } : undefined,
        viewport: part === 'viewport' ? { style: 'position: fixed; inset: 0' } : undefined,
      });
      await opened();
      await press(byTestId('field')!);
      expect(popup()).not.toBe(null);
      await press(byId('outside'));
      await closed();
      expect(reasons).toEqual(['outside-press']);
      unmount();
    }
  });

  test('a press that starts in the popup and ends outside closes nothing; a right button closes nothing', async () => {
    await mountDialog({ root: { defaultOpen: true, modal: 'trap-focus' } });
    const element = await opened();
    await userEvent.pointer([
      { coords: centerOf(byTestId('button')!) },
      '[MouseLeft>]',
      { coords: centerOf(byId('outside')) },
      '[/MouseLeft]',
    ]);
    await userEvent.click(byId('outside'), { button: 'right' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(popup()).toBe(element);
  });

  test('with disablePointerDismissal, an outside press closes nothing, and Escape closes', async () => {
    await mountDialog({ root: { defaultOpen: true, disablePointerDismissal: true } });
    await opened();
    await press(byId('outside'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(popup()).not.toBe(null);
    await userEvent.keyboard('{Escape}');
    await closed();
  });

  test('a click with no press on the document closes', async () => {
    await mountDialog({ root: { defaultOpen: true } });
    await opened();
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await closed();
  });

  test.each([
    { modal: true, at: 'an element of the page' },
    { modal: false, at: 'an element of the page' },
    { modal: false, at: 'an element of the shadow root' },
  ])(
    'a dialog in a shadow root with modal=$modal closes at a press on $at',
    async ({ modal, at }) => {
      const host = append('div');
      const shadow = host.attachShadow({ mode: 'open' });
      const outside = document.createElement('button');
      outside.textContent = 'In shadow';
      outside.style.cssText = 'position: fixed; left: 0; bottom: 0';
      shadow.append(outside);
      await mountDialog({ root: { defaultOpen: true, modal }, portal: { to: shadow } });
      await waitFor(() => expect(shadow.querySelector('[role="dialog"]')).not.toBe(null));
      await press(at === 'an element of the page' ? byId('outside') : outside);
      await waitFor(() => expect(shadow.querySelector('[role="dialog"]')).toBe(null));
    },
  );

  test('the first click outside after a scrub of a NumberField in the popup closes', async () => {
    mount(DialogWithScrub);
    await opened();
    const scrub = byTestId('scrub')!;
    scrub.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }),
    );
    document.body.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' }),
    );
    await new Promise((resolve) => setTimeout(resolve));
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await closed();
  });
});

describe('the focus', () => {
  test('goes to the first tab stop at a press open, to the popup after a touch open, and back to the trigger at the close', async () => {
    const { trigger } = await mountDialog({ root: { modal: false } });
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(byTestId('field')).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    await closed();
    await waitFor(() => expect(trigger()).toHaveFocus());
    expect(trigger().matches(':focus-visible')).toBe(true);
  });

  test.skipIf(server.browser !== 'chromium')('a touch open focuses the popup', async () => {
    const { trigger } = await mountDialog({ root: { modal: false } });
    await touchDrag(centerOf(trigger()), centerOf(trigger()), 0);
    const element = await opened();
    await waitFor(() => expect(element).toHaveFocus());
  });

  test('`initialFocus` gets the interaction type, and an element with autofocus takes the focus by default', async () => {
    const types: string[] = [];
    const { trigger } = await mountDialog({
      root: { modal: false },
      popup: {
        initialFocus: (type: string) => {
          types.push(type);
          return true;
        },
      },
    });
    trigger().focus();
    await userEvent.keyboard('{Enter}');
    await opened();
    await waitFor(() => expect(byTestId('field')).toHaveFocus());
    expect(types).toEqual(['keyboard']);
  });

  test('`finalFocus` replaces the return target', async () => {
    const { trigger } = await mountDialog({
      root: { defaultOpen: true },
      popup: { finalFocus: () => byId('after') },
    });
    await opened();
    void trigger;
    await userEvent.keyboard('{Escape}');
    await closed();
    await waitFor(() => expect(byId('after')).toHaveFocus());
  });

  test.each(['block', 'viewport', 'backdrop'] as const)(
    'a press on the %s keeps the focus in the field; a refused close opens an alert dialog, whose close gives the focus back to the field',
    async (part) => {
      const { root } = mount(DialogConfirm, { backdrop: part === 'backdrop' });
      await nextTick();
      await userEvent.click(root.querySelector('button')!);
      await opened();
      const text = byTestId('text') as HTMLTextAreaElement;
      await waitFor(() => expect(text).toHaveFocus());
      await userEvent.keyboard('x');
      const target =
        part === 'block'
          ? { x: window.innerWidth - 10, y: window.innerHeight - 10 }
          : { x: 20, y: 20 };
      await userEvent.pointer({ coords: target, keys: '[MouseLeft]' });
      await opened('confirm');
      await waitFor(() => expect(byTestId('back')).toHaveFocus());
      await userEvent.keyboard('{Enter}');
      await closed('confirm');
      await waitFor(() => expect(text).toHaveFocus());
      expect(popup()).not.toBe(null);
    },
  );

  test('an `initialFocus` on an inert element moves the focus to <body>, and the next Tab goes into the popup', async () => {
    const { trigger } = await mountDialog({ popup: { initialFocus: () => byId('before') } });
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(document.body));
    await userEvent.keyboard('{Tab}');
    expect(byTestId('field')).toHaveFocus();
  });

  test.each([true, false])(
    'BUG-6037: a `finalFocus` container gives the focus to its radio that stays, when the radio in the popup that leaves is checked=%s',
    async (checked) => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      mount(DialogRadioReturn, { checked });
      const element = await opened();
      element.querySelector('input')!.focus();
      await userEvent.keyboard('{Escape}');
      await waitFor(() =>
        expect(document.activeElement).toHaveAttribute('aria-label', 'Outside'),
      );
      expect(element.isConnected).toBe(true);
    },
  );

  test('BUG-5519: the focus goes back to the trigger at the close while the popup leaves, and the trigger is in use', async () => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
    const { root } = mount(DialogInTransition);
    await nextTick();
    const trigger = root.querySelector<HTMLElement>('[aria-haspopup="dialog"]')!;
    await userEvent.click(trigger);
    const element = await opened();
    await waitFor(() => expect(element.querySelector('button')).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(element.isConnected).toBe(true);
    expect(inert(trigger) || hidden(trigger)).toBe(false);
  });

  test('a dialog with no trigger that opened while <body> had the focus gives the focus to nothing at its close', async () => {
    const surface = append('div', 'position: fixed; right: 0; top: 0; width: 100px; height: 100px');
    const scene = reactive({ open: { 0: true } as Record<number, boolean> });
    mount(DialogSiblings, {
      dialogs: [{ root: { modal: false, disablePointerDismissal: true } }, { trigger: false }],
      scene,
    });
    const element = await opened('popup-0');
    const button = element.querySelector('button')!;
    await waitFor(() => expect(button).toHaveFocus());
    await press(surface);
    expect(document.activeElement).toBe(document.body);
    scene.open[1] = true;
    await opened('popup-1');
    await waitFor(() => expect(byTestId('popup-1')!.contains(document.activeElement)).toBe(true));
    await userEvent.keyboard('{Escape}');
    await closed('popup-1');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.activeElement).toBe(document.body);
  });
});
