import { describe, expect, inject, test } from 'vitest';
import { nextTick } from 'vue';
import { Dialog } from '@vase-ui/vue/dialog';
import DialogHandles from '../../test/fixtures/DialogHandles.vue';
import DialogLateTrigger from '../../test/fixtures/DialogLateTrigger.vue';
import DialogParts from '../../test/fixtures/DialogParts.vue';
import { hydrate, renderOnServer } from '../../test/render';
import { waitFor } from '../../test/waitFor';

const popupOf = (root: ParentNode) => root.querySelector('[data-testid="popup"]');
const SENTINEL = 'span[tabindex="0"][aria-hidden="true"]';

describe('server render and hydration', () => {
  test.each([
    { name: 'a closed root', props: {} },
    { name: 'an open root', props: { root: { defaultOpen: true } } },
    {
      name: 'an open root in an open root',
      props: { root: { defaultOpen: true }, inTree: { root: { defaultOpen: true } } },
    },
    { name: 'a closed root with keepMounted', props: { portal: { keepMounted: true } } },
  ])('the server HTML of $name has its triggers only', async ({ props }) => {
    const root = await renderOnServer('DialogParts', props);
    expect(root.querySelectorAll('[aria-haspopup="dialog"]').length).toBeGreaterThan(0);
    expect(root.querySelector('[role="dialog"]')).toBe(null);
  });

  test('an open root hydrates with no message, and its popup comes after the mount in <body>', async () => {
    const props = { root: { defaultOpen: true }, backdrop: {} };
    const root = await renderOnServer('DialogParts', props);
    const trigger = root.querySelector('button')!;
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    hydrate(DialogParts, props, root);
    await nextTick();
    expect(root.querySelector('button')).toBe(trigger);
    await waitFor(() => expect(popupOf(document.body)).not.toBe(null));
    expect(root.contains(popupOf(document.body))).toBe(false);
    expect(trigger).toHaveAttribute('aria-controls', popupOf(document.body)!.id);
  });

  test.each([true, false])(
    'VUE-128: a disabled portal of a dialog with modal=%s renders the popup in place with its role and id, with no fixed element and no sentinel; the popup gets its name after the mount',
    async (modal) => {
      // Vue 3.6 reports a mismatch when it hydrates the in-place portal of an open Vapor part in
      // another one.
      const nested = inject('app') !== 'vapor';
      const props = {
        root: { defaultOpen: true, modal },
        portal: { disabled: true },
        backdrop: {},
        title: {},
        nested: nested
          ? { root: { defaultOpen: true }, portal: { disabled: true }, backdrop: {} }
          : undefined,
      };
      const root = await renderOnServer('DialogParts', props);
      const element = popupOf(root)!;
      expect(element).toHaveAttribute('role', 'dialog');
      expect(element.id).not.toBe('');
      expect(element).not.toHaveAttribute('aria-labelledby');
      expect(root.querySelector('[data-testid="backdrop"]')).not.toBe(null);
      expect(root.querySelector('[data-testid="nested-popup"]') !== null).toBe(nested);
      expect(root.querySelector('[data-testid="nested-backdrop"]')).toBe(null);
      expect(root.querySelectorAll('[role="presentation"]:not([data-testid])')).toHaveLength(0);
      expect(root.querySelectorAll(SENTINEL)).toHaveLength(0);
      hydrate(DialogParts, props, root);
      await nextTick();
      expect(popupOf(root)).toBe(element);
      await waitFor(() =>
        expect(element).toHaveAttribute('aria-labelledby', element.querySelector('h2')!.id),
      );
    },
  );

  test('a trigger with a handle outside its open root is closed in the server HTML, and opens after the hydration', async () => {
    const props = { root: { defaultOpen: true, defaultTriggerId: 'first' } };
    const root = await renderOnServer('DialogHandles', props);
    const first = root.querySelector('#first')!;
    expect(first).toHaveAttribute('aria-expanded', 'false');
    hydrate(DialogHandles, { ...props, handle: Dialog.createHandle() }, root);
    await waitFor(() => expect(popupOf(document.body)).not.toBe(null));
    expect(root.querySelector('#first')).toBe(first);
    await waitFor(() => expect(first).toHaveAttribute('aria-expanded', 'true'));
  });

  // In Vue 3.6.0-rc.16, the async `setup` of a Vapor component does not make a `<Suspense>` wait.
  test.skipIf(inject('app').startsWith('vapor')).each([true, false])(
    'a trigger with a handle that hydrates after its root, open=%s at that time, hydrates with no message and shows the state of the root',
    async (open) => {
      const handle = Dialog.createHandle();
      let resume = () => {};
      const gate = new Promise<void>((resolve) => (resume = resolve));
      const root = await renderOnServer('DialogLateTrigger');
      const trigger = root.querySelector('#trigger')!;
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      hydrate(DialogLateTrigger, { handle, gate }, root);
      await waitFor(() => expect(handle.isOpen).toBe(true));
      if (!open) handle.close();
      resume();
      await gate;
      await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', String(open)));
      expect(root.querySelector('#trigger')).toBe(trigger);
    },
  );
});
