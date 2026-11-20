import { describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick, onMounted, onUnmounted, shallowRef } from 'vue';
import {
  createScrollDocument,
  HIDDEN_SCROLLBARS_CSS,
  isPageLocked,
} from '../../../../test/fixtures/scrollDocument';
import PopupPortal from './PopupPortal.vue';
import { Dialog } from '@vase-ui/vue/dialog';
import { AlertDialog } from '@vase-ui/vue/alert-dialog';
import { createRenderer, fireEvent, isVaporParts, screen, waitFor } from '#test-utils';

describe('PopupPortal parts', () => {
  const { render } = createRenderer();

  it('keeps one mounted child and the tab guards at the source of a guarded portal', async () => {
    expect((PopupPortal as { __vapor?: boolean }).__vapor === true).toBe(isVaporParts);
    const mount = vi.fn();
    const unmount = vi.fn();
    const Child = defineComponent(() => {
      onMounted(mount);
      onUnmounted(unmount);
      return () => <button>inside</button>;
    });

    await render(() => (
      <main data-testid="source">
        <div id="public-portal-target" data-testid="target" />
        <Dialog.Root defaultOpen modal={false}>
          <Dialog.Portal to="#public-portal-target" data-testid="portal">
            <Dialog.Popup>
              <Child />
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </main>
    ));

    expect(screen.getByTestId('portal').parentElement).toBe(screen.getByTestId('target'));
    expect(
      screen.getByTestId('source').querySelectorAll(':scope > [data-type="outside"]'),
    ).toHaveLength(2);
    expect(mount).toHaveBeenCalledTimes(1);
    expect(unmount).toHaveBeenCalledTimes(0);
  });

  it('VUE-20: moves the modal marks with an open dialog when its portal changes target', async () => {
    const to = shallowRef('#first-target');
    await render(() => (
      <main>
        <div id="first-target" data-testid="first" />
        <div id="second-target" data-testid="second" />
        <Dialog.Root defaultOpen>
          <Dialog.Portal to={to.value}>
            <Dialog.Popup>
              <button>inside</button>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </main>
    ));
    const popup = screen.getByRole('dialog');
    const first = screen.getByTestId('first');
    const second = screen.getByTestId('second');
    expect(second).toHaveAttribute('inert');
    expect(second).toHaveAttribute('aria-hidden', 'true');

    to.value = '#second-target';
    await nextTick();
    expect(second).toContainElement(popup);
    expect(popup.closest('[inert], [aria-hidden="true"]')).toBeNull();
    expect(first).toHaveAttribute('inert');
    expect(first).toHaveAttribute('aria-hidden', 'true');
  });

  it('moves the modal focus trap and scroll lock between frame documents', async () => {
    const first = await createScrollDocument({ css: HIDDEN_SCROLLBARS_CSS });
    const second = await createScrollDocument({ css: HIDDEN_SCROLLBARS_CSS });
    const to = shallowRef(first.body);
    const { unmount } = await render(() => (
      <Dialog.Root defaultOpen>
        <Dialog.Portal to={to.value}>
          <Dialog.Popup />
        </Dialog.Portal>
      </Dialog.Root>
    ));
    await waitFor(() => expect(isPageLocked(first)).toBe(true));
    const popup = first.body.querySelector<HTMLElement>('[role="dialog"]')!;
    to.value = second.body;
    await nextTick();
    expect(second.body.contains(popup)).toBe(true);
    popup.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    popup.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    await waitFor(() => expect([isPageLocked(first), isPageLocked(second)]).toEqual([false, true]));
    unmount();
    await waitFor(() => expect(isPageLocked(second)).toBe(false));
  });

  it('moves the Escape listener to the new document with the dialog', async () => {
    const to = shallowRef<Element>();
    const close = vi.fn();
    await render(() => (
      <main>
        <iframe title="portal target" data-testid="frame" />
        <Dialog.Root defaultOpen modal={false} onOpenChange={close}>
          <Dialog.Portal to={to.value}>
            <Dialog.Popup />
          </Dialog.Portal>
        </Dialog.Root>
      </main>
    ));
    const popup = screen.getByRole('dialog');
    const frame = screen.getByTestId<HTMLIFrameElement>('frame').contentDocument!;
    to.value = frame.body;
    await nextTick();
    expect(frame.body.contains(popup)).toBe(true);

    await fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(close).not.toHaveBeenCalled();
    await fireEvent.keyDown(frame.body, { key: 'Escape' });
    expect(close).toHaveBeenCalledOnce();
    expect(close.mock.calls[0]?.[1].reason).toBe('escape-key');
  });

  it('keeps the modal marks after a nested alert vetoes Escape and releases them on the last close', async () => {
    let veto = true;
    const { user } = await render(() => (
      <>
        <button data-testid="outside">outside</button>
        <Dialog.Root defaultOpen>
          <Dialog.Portal>
            <Dialog.Popup>
              <AlertDialog.Root
                defaultOpen
                onOpenChange={(open, details) => {
                  if (!open && veto) {
                    details.cancel();
                  }
                }}
              >
                <AlertDialog.Portal>
                  <AlertDialog.Popup>
                    <button>confirm</button>
                  </AlertDialog.Popup>
                </AlertDialog.Portal>
              </AlertDialog.Root>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </>
    ));
    const outside = screen.getByTestId('outside');
    function marked() {
      return !!outside.closest('[inert]') && !!outside.closest('[aria-hidden="true"]');
    }
    await waitFor(() => expect(marked()).toBe(true));
    const alert = screen.getByRole('alertdialog');
    await fireEvent.keyDown(alert, { key: 'Escape' });
    expect(screen.getByRole('alertdialog')).toBe(alert);
    expect(marked()).toBe(true);
    veto = false;
    await user.keyboard('{Escape}');
    await waitFor(() => expect(alert.isConnected).toBe(false));
    expect(marked()).toBe(true);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(outside.closest('[inert], [aria-hidden="true"]')).toBe(null));
  });
});
