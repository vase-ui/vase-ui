import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick } from 'vue';
import { AlertDialog, type AlertDialogRootChangeEventDetails } from '@vase-ui/vue/alert-dialog';
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
