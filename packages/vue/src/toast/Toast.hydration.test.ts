import { describe, expect, inject, test } from 'vitest';
import { nextTick } from 'vue';
import ToastServer from '../../test/fixtures/ToastServer.vue';
import { hydrate, renderOnServer } from '../../test/render';
import { waitFor } from '../../test/waitFor';

describe('server render and hydration (B10)', () => {
  test('a viewport in place is in the server HTML with the toasts of a setup: the variables with no height, no sentinel and no alert', async () => {
    const root = await renderOnServer('ToastServer');
    const viewport = root.querySelector('[role="region"]')!;
    expect(viewport).toHaveAttribute('aria-live', 'polite');
    const toast = root.querySelector<HTMLElement>('[data-id="b"]')!;
    expect(toast.style.getPropertyValue('--toast-index')).toBe('0');
    expect(toast.style.getPropertyValue('--toast-offset-y')).toBe('0px');
    expect(toast.style.getPropertyValue('--toast-height')).toBe('');
    expect(toast.style.getPropertyValue('--toast-swipe-movement-x')).toBe('0px');
    expect(root.querySelector('[data-id="a"] h2 strong')).toHaveTextContent('Bold');
    expect(viewport.querySelector('span[tabindex="0"]')).toBe(null);
    expect(root.querySelector('[role="alert"]')).toBe(null);
  });

  test('a viewport in a portal is not in the server HTML', async () => {
    const root = await renderOnServer('ToastServer', { portal: true });
    expect(root.querySelector('[role="region"]')).toBe(null);
  });

  // A Vapor app without the interop plugin renders no virtual DOM content of a label that is a
  // function.
  test.skipIf(inject('app') === 'vapor')(
    'hydrates with no message; the alert of the toast of high priority comes after the mount, with the component of its title',
    async () => {
      const root = await renderOnServer('ToastServer');
      const toast = root.querySelector('[data-id="a"]');
      hydrate(ToastServer, {}, root);
      await nextTick();
      expect(root.querySelector('[data-id="a"]')).toBe(toast);
      const alert = await waitFor(() => {
        const found = root.querySelector('[role="alert"]');
        expect(found).not.toBe(null);
        return found!;
      });
      expect(alert.querySelector('strong')).toHaveTextContent('Bold');
      expect(alert).toHaveTextContent('BoldSaved');
    },
  );

  test('a manager of a module gives no toast to a server render, also in a second render', async () => {
    for (let render = 0; render < 2; render += 1) {
      const root = await renderOnServer('ToastSharedManager');
      expect(root.querySelector('[role="region"]')).not.toBe(null);
      expect(root.querySelector('[data-id]')).toBe(null);
    }
  });
});
