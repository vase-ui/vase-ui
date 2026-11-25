import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import DrawerParts from '../../test/fixtures/DrawerParts.vue';
import { hydrate, renderOnServer } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';
import { waitFor } from '../../test/waitFor';

const popupOf = (root: ParentNode) => root.querySelector<HTMLElement>('[data-testid="popup"]');

describe('server render and hydration', () => {
  test.each([
    { name: 'a closed root', props: {} },
    { name: 'an open root', props: { root: { defaultOpen: true } } },
    {
      name: 'an open root in an open root',
      props: { root: { defaultOpen: true }, nested: { root: { defaultOpen: true } } },
    },
  ])('the server HTML of $name has its trigger only', async ({ props }) => {
    const root = await renderOnServer('DrawerParts', props);
    expect(root.querySelectorAll('[aria-haspopup="dialog"]')).toHaveLength(1);
    expect(root.querySelector('[role="dialog"]')).toBe(null);
  });

  test('an open root hydrates with no message, and its popup comes after the mount in <body>', async () => {
    const props = { root: { defaultOpen: true }, backdrop: {} };
    const root = await renderOnServer('DrawerParts', props);
    const trigger = root.querySelector('button')!;
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    hydrate(DrawerParts, props, root);
    await nextTick();
    expect(root.querySelector('button')).toBe(trigger);
    await waitFor(() => expect(popupOf(document.body)).not.toBe(null));
    expect(root.contains(popupOf(document.body))).toBe(false);
  });

  test('a disabled portal renders the shown popup and backdrop in place with no `display: none` and the variables of a drawer at rest', async () => {
    const props = { root: { defaultOpen: true }, portal: { disabled: true }, backdrop: {} };
    const root = await renderOnServer('DrawerParts', props);
    const popup = popupOf(root)!;
    const backdrop = root.querySelector<HTMLElement>('[data-testid="backdrop"]')!;
    expect(popup).toHaveAttribute('role', 'dialog');
    expect(popup.style.display).toBe('');
    expect(backdrop.style.display).toBe('');
    expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px');
    expect(popup.style.getPropertyValue('--drawer-snap-point-offset')).toBe('0px');
    expect(backdrop.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
    hydrate(DrawerParts, props, root);
    await nextTick();
    expect(popupOf(root)).toBe(popup);
    expect(root.querySelector<HTMLElement>('[data-testid="backdrop"]')).toBe(backdrop);
    expect(popup.style.display).toBe('');
    expect(backdrop.style.display).toBe('');
    expect(takeReportedMessages()).toEqual([]);
  });

  test('a provider is not active in the server HTML, and is active after the mount of an open root', async () => {
    const props = { root: { defaultOpen: true }, provider: true };
    const root = await renderOnServer('DrawerParts', props);
    const indent = root.querySelector('[data-testid="indent"]')!;
    expect(indent).not.toHaveAttribute('data-active');
    expect(indent.getAttribute('style')).toContain('--drawer-swipe-progress:0');
    hydrate(DrawerParts, props, root);
    await waitFor(() => expect(indent).toHaveAttribute('data-active'));
  });
});
