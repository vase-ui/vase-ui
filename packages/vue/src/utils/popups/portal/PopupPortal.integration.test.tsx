import { describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick, onMounted, onUnmounted, shallowRef } from 'vue';
import {
  createScrollDocument,
  HIDDEN_SCROLLBARS_CSS,
  isPageLocked,
} from '../../../../test/fixtures/scrollDocument';
import PopupPortal from './PopupPortal.vue';
import { Toast } from '@vase-ui/vue/toast';
import { Drawer } from '@vase-ui/vue/drawer';
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
        <Drawer.Root defaultOpen modal={false}>
          <Drawer.Portal to="#public-portal-target" data-testid="portal">
            <Drawer.Viewport>
              <Drawer.Popup>
                <Child />
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
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

  it('VUE-168: resolves a selector whose target mounts later in the same update', async () => {
    const show = shallowRef(false);
    await render(() => (
      <main>
        <Toast.Portal to={show.value ? '#late-portal-target' : null} data-testid="portal" />
        {show.value && <div id="late-portal-target" data-testid="target" />}
      </main>
    ));

    show.value = true;
    await nextTick();
    expect(screen.getByTestId('portal').parentElement).toBe(screen.getByTestId('target'));
  });

  it('VUE-168: resolves a nested selector in the new document when its parent portal moves', async () => {
    const first = await createScrollDocument();
    const second = await createScrollDocument();
    const to = shallowRef(first.body);
    first.reference.id = 'nested-portal-target';
    second.reference.id = 'nested-portal-target';
    await render(() => (
      <Toast.Portal to={to.value}>
        <Toast.Portal to="#nested-portal-target" data-testid="nested" />
      </Toast.Portal>
    ));
    const nested = first.reference.querySelector('[data-testid="nested"]');
    expect(nested).toBeTruthy();

    to.value = second.body;
    await nextTick();
    expect(second.reference.querySelector('[data-testid="nested"]')).toBe(nested);
  });

  it('VUE-20: moves the modal marks with an open drawer when its portal changes target', async () => {
    const to = shallowRef('#first-target');
    await render(() => (
      <main>
        <div id="first-target" data-testid="first" />
        <div id="second-target" data-testid="second" />
        <Drawer.Root defaultOpen>
          <Drawer.Portal to={to.value}>
            <Drawer.Viewport>
              <Drawer.Popup>
                <button>inside</button>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </main>
    ));
    const popup = screen.getAllByRole('dialog')[0]!;
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
      <Drawer.Root defaultOpen>
        <Drawer.Portal to={to.value}>
          <Drawer.Viewport>
            <Drawer.Popup />
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
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

  it('moves the Escape listener to the new document with the drawer', async () => {
    const to = shallowRef<Element>();
    const close = vi.fn();
    await render(() => (
      <main>
        <iframe title="portal target" data-testid="frame" />
        <Drawer.Root defaultOpen modal={false} onOpenChange={close}>
          <Drawer.Portal to={to.value}>
            <Drawer.Viewport>
              <Drawer.Popup />
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </main>
    ));
    const popup = screen.getAllByRole('dialog')[0]!;
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

  it('keeps the modal marks after a nested drawer vetoes Escape and releases them on the last close', async () => {
    let veto = true;
    const { user } = await render(() => (
      <>
        <button data-testid="outside">outside</button>
        <Drawer.Root defaultOpen>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup>
                <Drawer.Root
                  defaultOpen
                  onOpenChange={(open, details) => {
                    if (!open && veto) {
                      details.cancel();
                    }
                  }}
                >
                  <Drawer.Portal>
                    <Drawer.Viewport>
                      <Drawer.Popup data-testid="nested">
                        <button>confirm</button>
                      </Drawer.Popup>
                    </Drawer.Viewport>
                  </Drawer.Portal>
                </Drawer.Root>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </>
    ));
    const outside = screen.getByTestId('outside');
    function marked() {
      return !!outside.closest('[inert]') && !!outside.closest('[aria-hidden="true"]');
    }
    await waitFor(() => expect(marked()).toBe(true));
    const alert = screen.getByTestId('nested');
    await fireEvent.keyDown(alert, { key: 'Escape' });
    expect(screen.getByTestId('nested')).toBe(alert);
    expect(marked()).toBe(true);
    veto = false;
    await user.keyboard('{Escape}');
    await waitFor(() => expect(alert.isConnected).toBe(false));
    expect(marked()).toBe(true);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(outside.closest('[inert], [aria-hidden="true"]')).toBe(null));
  });
});
