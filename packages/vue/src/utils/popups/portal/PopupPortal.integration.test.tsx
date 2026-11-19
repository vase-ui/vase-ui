import { describe, expect, it, vi } from 'vitest';
import { defineComponent, onMounted, onUnmounted } from 'vue';
import PopupPortal from './PopupPortal.vue';
import { Toast } from '@vase-ui/vue/toast';
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

  it('VUE-128: renders a guard-free portal inline even with a null target', async () => {
    await render(() => (
      <section data-testid="source">
        <Toast.Portal to={null} disabled data-testid="portal" />
      </section>
    ));
    expect(screen.getByTestId('portal').parentElement).toBe(screen.getByTestId('source'));
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
