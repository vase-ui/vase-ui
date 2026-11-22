import { describe, expect, inject, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { DialogRootChangeEventDetails } from '@vase-ui/vue/dialog';
import DialogAsyncContent from '../../test/fixtures/DialogAsyncContent.vue';
import DialogParts from '../../test/fixtures/DialogParts.vue';
import DialogWithMenus from '../../test/fixtures/DialogWithMenus.vue';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const get = (id: string) => byTestId(id)!;
const byId = (id: string) => document.getElementById(id)!;
const popup = () => byTestId('popup');

async function opened(id = 'popup') {
  await waitFor(() => expect(byTestId(id)).not.toBe(null));
  return get(id);
}

async function closed(id = 'popup') {
  await waitFor(() => expect(byTestId(id)).toBe(null));
}

/** Props of a root that write each `openChange` in `log`. */
function logged(log: string[], props: Props = {}) {
  return reactive<Props>({
    ...props,
    onOpenChange: (open: boolean, details: DialogRootChangeEventDetails) =>
      log.push(`${open} ${details.reason}`),
  });
}

async function mountDialog(setup: Props = {}) {
  const { root, exposed } = mount(DialogParts, setup);
  await nextTick();
  return {
    exposed,
    trigger: (key = 't') => root.querySelector<HTMLElement>(`[data-key="${key}"]`)!,
  };
}

describe('the trigger and the close button', () => {
  test('a disabled trigger of another element is out of the Tab order, has aria-disabled, and opens nothing', async () => {
    const { trigger } = await mountDialog({
      root: { modal: false },
      triggers: [{ key: 'span', attrs: { as: 'span', disabled: true } }],
    });
    const span = trigger('span');
    expect(span).toHaveAttribute('aria-disabled', 'true');
    expect(span).not.toHaveAttribute('disabled');
    await userEvent.click(span, { force: true });
    await nextTick();
    expect(popup()).toBe(null);
    byId('before').focus();
    await userEvent.keyboard('{Tab}');
    expect(span).not.toHaveFocus();
  });

  test('a disabled trigger button is out of the Tab order', async () => {
    const { trigger } = await mountDialog({
      root: { modal: false },
      triggers: [{ key: 'button', attrs: { disabled: true } }],
    });
    byId('before').focus();
    await userEvent.keyboard('{Tab}');
    expect(trigger('button')).not.toHaveFocus();
  });

  test('a disabled close button of another element has aria-disabled and closes nothing', async () => {
    const log: string[] = [];
    await mountDialog({
      root: logged(log, { defaultOpen: true }),
      close: { as: 'span', disabled: true, 'data-testid': 'close' },
    });
    await opened();
    expect(get('close')).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(get('close'), { force: true });
    await nextTick();
    expect(popup()).not.toBe(null);
    expect(log).toEqual([]);
  });

  test('a close button and a trigger with an `onClick` of undefined still work', async () => {
    const log: string[] = [];
    const { trigger } = await mountDialog({
      root: logged(log),
      triggers: [{ key: 't', attrs: { onClick: undefined } }],
      close: { onClick: undefined, 'data-testid': 'close' },
    });
    await userEvent.click(trigger());
    await opened();
    await userEvent.click(get('close'));
    await closed();
    expect(log).toEqual(['true trigger-press', 'false close-press']);
  });

  test('the `id` of the popup is the one that the trigger names in aria-controls', async () => {
    const { trigger } = await mountDialog({ root: { open: true }, popup: { id: 'mine' } });
    const element = await opened();
    expect(element).toHaveAttribute('id', 'mine');
    await waitFor(() => expect(trigger()).toHaveAttribute('aria-controls', 'mine'));
  });

  test('the viewport is in the DOM only while the dialog is open', async () => {
    const { trigger } = await mountDialog({ root: { modal: false }, viewport: {} });
    expect(byTestId('viewport')).toBe(null);
    await userEvent.click(trigger());
    const element = await opened();
    expect(get('viewport').contains(element)).toBe(true);
  });
});

describe('the open state', () => {
  test('`defaultOpen` does nothing with `open` false', async () => {
    await mountDialog({ root: { defaultOpen: true, open: false } });
    await nextTick();
    expect(popup()).toBe(null);
  });

  test('a parent that keeps `open` true gets each request to close', async () => {
    const log: string[] = [];
    await mountDialog({ root: logged(log, { open: true }) });
    await opened();
    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('{Escape}');
    expect(popup()).not.toBe(null);
    expect(log).toEqual(['false escape-key', 'false escape-key']);
  });

  test('close() of a template ref emits nothing while the dialog is closed, also after the parent opened and closed it', async () => {
    const log: string[] = [];
    const root = logged(log, { open: false });
    const { trigger, exposed } = await mountDialog({ root });
    exposed.root.close();
    // The parent does not follow the request of the press.
    await userEvent.click(trigger());
    root.open = true;
    await opened();
    root.open = false;
    await closed();
    log.length = 0;
    exposed.root.close();
    await nextTick();
    expect(log).toEqual([]);
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  });

  // Vue 3.6 runs no `<Suspense>` in a Vapor app with Vapor parts.
  test.skipIf(inject('app') === 'vapor')(
    'an async component in the popup of an open dialog in a <Suspense> shows when it loads',
    async () => {
      let load = () => {};
      const loaded = new Promise<void>((resolve) => (load = resolve));
      mount(DialogAsyncContent, { loaded });
      await opened();
      load();
      await waitFor(() => expect(popup()).toHaveTextContent('Greetings'));
    },
  );
});

describe('the dismissal', () => {
  test('an outside press closes a dialog that opened again after an Escape', async () => {
    const { trigger } = await mountDialog({ root: { modal: false } });
    await userEvent.click(trigger());
    await opened();
    await userEvent.keyboard('{Escape}');
    await closed();
    await userEvent.click(trigger());
    await opened();
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await closed();
  });

  test('a press that starts in the popup and ends on the document closes nothing, and the next press closes', async () => {
    const log: string[] = [];
    await mountDialog({ root: logged(log, { defaultOpen: true }) });
    const element = await opened();
    const fire = (target: EventTarget, type: string) =>
      target.dispatchEvent(
        type.startsWith('pointer')
          ? new PointerEvent(type, { bubbles: true, pointerType: 'mouse', button: 0 })
          : new MouseEvent(type, { bubbles: true, button: 0, detail: 1 }),
      );
    fire(element, 'pointerdown');
    fire(element, 'mousedown');
    fire(document, 'pointerup');
    fire(document, 'mouseup');
    fire(document, 'click');
    await nextTick();
    expect(popup()).not.toBe(null);
    expect(log).toEqual([]);
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      fire(document, type);
    }
    await closed();
    expect(log).toEqual(['false outside-press']);
  });

  test.each(['menu in dialog', 'select in dialog'] as const)(
    'with a %s, an outside press closes the inner popup, and the next one the dialog',
    async (variant) => {
      mount(DialogWithMenus, { variant });
      await nextTick();
      await userEvent.click(get('open'));
      await opened();
      await userEvent.click(get('inner-trigger'));
      await opened('inner');
      await userEvent.pointer({ coords: { x: 5, y: 5 }, keys: '[MouseLeft]' });
      await waitFor(() => expect(get('inner-trigger')).toHaveAttribute('aria-expanded', 'false'));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(popup()).not.toBe(null);
      await userEvent.pointer({ coords: { x: 5, y: 5 }, keys: '[MouseLeft]' });
      await closed();
    },
  );

  test('Escape in a dialog that an item of a menu opened closes the dialog, and the menu stays', async () => {
    mount(DialogWithMenus, { variant: 'dialog in menu' });
    await nextTick();
    await userEvent.click(get('menu-trigger'));
    await opened('menu');
    await userEvent.click(get('open'));
    await opened();
    await userEvent.keyboard('{Escape}');
    await closed();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(byTestId('menu')).not.toBe(null);
  });
});
