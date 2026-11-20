import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { DialogRootChangeEventDetails } from '@vase-ui/vue/dialog';
import DialogParts from '../../test/fixtures/DialogParts.vue';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const popup = () => document.querySelector<HTMLElement>('[data-testid="popup"]');
const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
const byId = (id: string) => document.getElementById(id)!;

async function mountDialog(setup: Props = {}) {
  const { root, exposed, unmount } = mount(DialogParts, setup);
  await nextTick();
  const trigger = (key = 't') => root.querySelector<HTMLElement>(`[data-key="${key}"]`)!;
  return { root, exposed, unmount, trigger };
}

function rootEvents(log: string[], props: Props = {}) {
  return reactive<Props>({
    ...props,
    onOpenChange: (open: boolean, details: DialogRootChangeEventDetails) =>
      log.push(`openChange ${open} ${details.reason}`),
    'onUpdate:open': (open: boolean) => log.push(`update ${open}`),
  });
}

async function opened() {
  await waitFor(() => expect(popup()).not.toBe(null));
  return popup()!;
}

async function closed() {
  await waitFor(() => expect(popup()).toBe(null));
}

describe('smoke', () => {
  test('opens, traps, closes with Escape, returns the focus', async () => {
    const log: string[] = [];
    const { trigger } = await mountDialog({ root: rootEvents(log), close: {} });
    await userEvent.click(trigger());
    const element = await opened();
    await waitFor(() => expect(byTestId('field')).toHaveFocus());
    expect(element).toHaveAttribute('role', 'dialog');
    expect(element).toHaveAttribute('aria-modal', 'true');
    expect(byId('before').closest('[inert]')).not.toBe(null);
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(log).toEqual([
      'openChange true trigger-press',
      'update true',
      'openChange false escape-key',
      'update false',
    ]);
    expect(byId('before').closest('[inert]')).toBe(null);
    await waitFor(() => expect(trigger()).toHaveFocus());
  });

  test('a press on the block closes', async () => {
    const { trigger } = await mountDialog({ root: { defaultOpen: true } });
    await opened();
    await userEvent.click(byId('outside'), { force: true });
    await closed();
    expect(trigger()).toBeTruthy();
  });
});
