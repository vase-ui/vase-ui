import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import { AlertDialog, type AlertDialogRootChangeEventDetails } from '@vase-ui/vue/alert-dialog';
import AlertDialogBusy from '../../test/fixtures/AlertDialogBusy.vue';
import DialogHandleScene from '../../test/fixtures/DialogHandleScene.vue';
import DialogHandles from '../../test/fixtures/DialogHandles.vue';
import DialogPartAlone from '../../test/fixtures/DialogPartAlone.vue';
import DialogParts from '../../test/fixtures/DialogParts.vue';
import { mount, mountError } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const popup = () => byTestId('popup');
const byId = (id: string) => document.getElementById(id)!;
const inert = (element: Element) => element.closest('[inert]') !== null;

async function mountAlertDialog(setup: Props = {}) {
  const { root } = mount(DialogParts, { alert: true, ...setup });
  await nextTick();
  return { trigger: (key = 't') => root.querySelector<HTMLElement>(`[data-key="${key}"]`)! };
}

async function opened() {
  await waitFor(() => expect(popup()).not.toBe(null));
  return popup()!;
}

async function closed() {
  await waitFor(() => expect(popup()).toBe(null));
}

describe('Alert Dialog', () => {
  test('has the role alertdialog and aria-modal; the page and the trigger are inert; the seven parts of Dialog work below its root', async () => {
    const { trigger } = await mountAlertDialog({
      backdrop: {},
      viewport: {},
      title: {},
      description: {},
      close: { 'data-testid': 'close' },
    });
    await userEvent.click(trigger());
    const element = await opened();
    expect(element).toHaveAttribute('role', 'alertdialog');
    expect(element).toHaveAttribute('aria-modal', 'true');
    expect(element).toHaveAttribute('aria-labelledby', element.querySelector('h2')!.id);
    expect(element).toHaveAttribute('aria-describedby', element.querySelector('p')!.id);
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(byTestId('viewport')).toHaveAttribute('role', 'presentation');
    expect(byTestId('backdrop')).toHaveAttribute('role', 'presentation');
    await waitFor(() => expect(inert(byId('before'))).toBe(true));
    expect(inert(trigger())).toBe(true);
    await waitFor(() => expect(byTestId('field')).toHaveFocus());
    await userEvent.click(byTestId('close')!);
    await closed();
    await waitFor(() => expect(trigger()).toHaveFocus());
  });

  test('a press on the backdrop or on the fixed element closes nothing; Escape closes, and a parent can refuse it', async () => {
    const reasons: string[] = [];
    const parent = { refuse: true };
    const root = {
      defaultOpen: true,
      onOpenChange: (_: boolean, details: AlertDialogRootChangeEventDetails) => {
        reasons.push(details.reason);
        if (parent.refuse) details.cancel();
      },
    };
    await mountAlertDialog({
      root,
      backdrop: { style: 'position: fixed; left: 0; top: 0; width: 50px; height: 50px' },
    });
    await opened();
    await userEvent.click(byTestId('backdrop')!, { force: true });
    await userEvent.click(byId('outside'), { force: true });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(popup()).not.toBe(null);
    await userEvent.keyboard('{Escape}');
    expect(popup()).not.toBe(null);
    parent.refuse = false;
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(reasons).toEqual(['escape-key', 'escape-key']);
  });

  test.each([
    { opens: 'at a press', root: {}, portal: {} },
    { opens: 'in place at the mount', root: { defaultOpen: true }, portal: { disabled: true } },
  ])(
    'a busy dialog that opens $opens gives the first focus to Cancel, which a component makes focusable while disabled after its mount',
    async ({ root, portal }) => {
      mount(AlertDialogBusy, { root, portal });
      await nextTick();
      if (!root.defaultOpen) await userEvent.click(byTestId('trigger')!);
      await waitFor(() => expect(byTestId('cancel')).toHaveFocus());
      expect(byTestId('cancel')).toHaveAttribute('aria-disabled', 'true');
    },
  );

  test('a handle connects triggers outside the root and opens with a payload', async () => {
    const handle = AlertDialog.createHandle<string>();
    const { root } = mount(DialogHandles, { handle, alert: true });
    await nextTick();
    await userEvent.click(root.querySelector<HTMLElement>('#second')!);
    await opened();
    expect(byTestId('payload')).toHaveTextContent('second');
    expect(popup()).toHaveAttribute('role', 'alertdialog');
    handle.close();
    await closed();
    handle.openWithPayload('given');
    await opened();
    expect(byTestId('payload')).toHaveTextContent('given');
    expect(handle.isOpen).toBe(true);
  });

  test('an open root with a handle and `defaultTriggerId` marks that trigger, in the root and outside it', async () => {
    const handle = AlertDialog.createHandle();
    const { trigger } = await mountAlertDialog({
      root: { handle, defaultOpen: true, defaultTriggerId: 'inside' },
      triggers: [{ key: 't', attrs: { id: 'inside' } }],
    });
    let element = await opened();
    await waitFor(() => expect(trigger()).toHaveAttribute('aria-expanded', 'true'));
    expect(trigger()).toHaveAttribute('aria-controls', element.id);
    expect(handle.isOpen).toBe(true);
    handle.close();
    await closed();
    const scene = reactive({
      triggerHandle: AlertDialog.createHandle(),
      rootHandle: undefined as unknown,
      roots: ['r'],
      triggers: ['detached'],
    });
    scene.rootHandle = scene.triggerHandle;
    mount(DialogHandleScene, {
      alert: true,
      scene,
      root: { defaultOpen: true, defaultTriggerId: 'detached' },
    });
    element = await waitFor(() => {
      expect(byTestId('popup-r')).not.toBe(null);
      return byTestId('popup-r')!;
    });
    await waitFor(() => expect(byId('detached')).toHaveAttribute('aria-expanded', 'true'));
    expect(byId('detached')).toHaveAttribute('aria-controls', element.id);
    expect(scene.triggerHandle.isOpen).toBe(true);
  });

  test('a parent that refuses a close keeps the trigger expanded and the handle open', async () => {
    const handle = AlertDialog.createHandle();
    const root = reactive<Props>({ handle, open: false });
    root['onUpdate:open'] = (open: boolean) => {
      if (open) root.open = true;
    };
    const { trigger } = await mountAlertDialog({ root, close: { 'data-testid': 'close' } });
    await userEvent.click(trigger());
    await opened();
    expect(handle.isOpen).toBe(true);
    await userEvent.click(byTestId('close')!);
    await nextTick();
    expect(popup()).not.toBe(null);
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(handle.isOpen).toBe(true);
  });

  test('a root with a handle that mounts again after an unmount while open connects its trigger, and a press on its backdrop closes nothing', async () => {
    const handle = AlertDialog.createHandle();
    const scene = reactive({
      triggerHandle: handle,
      rootHandle: handle,
      roots: ['r'],
      triggers: ['a'],
    });
    mount(DialogHandleScene, { alert: true, scene });
    await nextTick();
    await userEvent.click(byId('a'));
    let element = await waitFor(() => {
      expect(byTestId('popup-r')).not.toBe(null);
      return byTestId('popup-r')!;
    });
    expect(byId('a')).toHaveAttribute('aria-controls', element.id);
    scene.roots = [];
    await waitFor(() => expect(byTestId('popup-r')).toBe(null));
    scene.roots = ['r'];
    await nextTick();
    expect(byTestId('popup-r')).toBe(null);
    await userEvent.click(byId('a'));
    element = await waitFor(() => {
      expect(byTestId('popup-r')).not.toBe(null);
      return byTestId('popup-r')!;
    });
    expect(byId('a')).toHaveAttribute('aria-controls', element.id);
    await userEvent.click(byTestId('backdrop-r')!, { force: true });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(byTestId('popup-r')).not.toBe(null);
    expect(handle.isOpen).toBe(true);
  });

  // The case throws in `setup`, so it is the last of the file.
  test('its trigger with no root and no handle throws an error that names it', () => {
    const error = mountError(DialogPartAlone, { part: 'Trigger', alert: true });
    // After the error, Vapor renders the part with no setup, and warns about each binding.
    takeReportedMessages();
    expect((error as Error).message).toBe(
      'Vase UI: <AlertDialog.Trigger> must be inside <AlertDialog.Root>, or it must have a `handle`. Without a root the trigger has no dialog to open. Put the trigger inside <AlertDialog.Root>, or pass a `handle`.',
    );
  });
});
