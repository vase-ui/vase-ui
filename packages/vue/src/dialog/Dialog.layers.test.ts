import { describe, expect, onTestFinished, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { DialogRootChangeEventDetails } from '@vase-ui/vue/dialog';
import DialogInShadow from '../../test/fixtures/DialogInShadow.vue';
import DialogLevels from '../../test/fixtures/DialogLevels.vue';
import DialogParts from '../../test/fixtures/DialogParts.vue';
import DialogSiblings from '../../test/fixtures/DialogSiblings.vue';
import DialogTwoOpen from '../../test/fixtures/DialogTwoOpen.vue';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const nestedCount = (element: HTMLElement) => element.style.getPropertyValue('--nested-dialogs');

async function opened(id: string) {
  await waitFor(() => expect(byTestId(id)).not.toBe(null));
  return byTestId(id)!;
}

async function closed(id: string) {
  await waitFor(() => expect(byTestId(id)).toBe(null));
}

/** A real mouse press at the center of the element. */
async function press(element: Element) {
  const rect = element.getBoundingClientRect();
  await userEvent.pointer({
    coords: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    keys: '[MouseLeft]',
  });
}

describe('a closed shadow root', () => {
  /** A closed shadow root, in `levels - 1` closed shadow roots around it. */
  function closedShadowRoot(levels = 1) {
    const host = document.body.appendChild(document.createElement('div'));
    onTestFinished(() => host.remove());
    let shadow = host.attachShadow({ mode: 'closed' });
    for (let level = 1; level < levels; level += 1) {
      shadow = shadow.appendChild(document.createElement('div')).attachShadow({ mode: 'closed' });
    }
    const container = shadow.appendChild(document.createElement('div'));
    const find = async (id: string) => {
      const selector = `[data-testid="${id}"]`;
      return waitFor(() => {
        const element = shadow.querySelector(selector) ?? document.querySelector(selector);
        expect(element, id).not.toBe(null);
        return element as HTMLElement;
      });
    };
    const absent = (id: string) => {
      const selector = `[data-testid="${id}"]`;
      return shadow.querySelector(selector) === null && document.querySelector(selector) === null;
    };
    return { shadow, container, find, absent };
  }

  const kinds = ['modal', 'not modal', 'alert'] as const;
  // No target is the target of the portal above, else <body>.
  const targets = [
    { outer: 'shadow root', inner: 'none' },
    { outer: 'shadow root', inner: 'shadow root' },
    { outer: 'shadow root', inner: 'body' },
    { outer: 'none', inner: 'none' },
    { outer: 'none', inner: 'shadow root' },
  ] as const;

  test.each(kinds.flatMap((nested) => targets.map((target) => ({ nested, ...target }))))(
    'the close of a nested dialog of the kind $nested keeps the parent open, with the portals in $outer and $inner',
    async ({ nested, outer, inner }) => {
      const { shadow, container, find, absent } = closedShadowRoot();
      const targetOf = (name: string) =>
        name === 'shadow root' ? shadow : name === 'body' ? document.body : undefined;
      const reasons: string[] = [];
      mount(
        DialogInShadow,
        {
          nested,
          outerTo: targetOf(outer),
          nestedTo: targetOf(inner),
          root: {
            onOpenChange: (_open: boolean, details: DialogRootChangeEventDetails) =>
              reasons.push(details.reason),
          },
        },
        container,
      );
      (await find('open-nested')).click();
      await find('nested');
      (await find('close-nested')).click();
      await waitFor(() => expect(absent('nested')).toBe(true));
      expect(await find('outer')).not.toBe(null);
      expect(reasons).toEqual([]);
    },
  );

  test.each(targets)(
    'the close of a nested dialog that is not modal keeps the parent open, with the portals in $outer and $inner, in a closed shadow root in a closed shadow root',
    async ({ outer, inner }) => {
      const { shadow, container, find, absent } = closedShadowRoot(2);
      const targetOf = (name: string) =>
        name === 'shadow root' ? shadow : name === 'body' ? document.body : undefined;
      const reasons: string[] = [];
      mount(
        DialogInShadow,
        {
          nested: 'not modal',
          outerTo: targetOf(outer),
          nestedTo: targetOf(inner),
          root: {
            onOpenChange: (_open: boolean, details: DialogRootChangeEventDetails) =>
              reasons.push(details.reason),
          },
        },
        container,
      );
      (await find('open-nested')).click();
      await find('nested');
      (await find('close-nested')).click();
      await waitFor(() => expect(absent('nested')).toBe(true));
      expect(await find('outer')).not.toBe(null);
      expect(reasons).toEqual([]);
    },
  );

  test('an outside press closes a dialog that is not modal', async () => {
    const { shadow, container, find, absent } = closedShadowRoot();
    const reasons: string[] = [];
    mount(
      DialogInShadow,
      {
        nested: 'not modal',
        outerTo: shadow,
        root: {
          onOpenChange: (_open: boolean, details: DialogRootChangeEventDetails) =>
            reasons.push(details.reason),
        },
      },
      container,
    );
    await find('outer');
    (await find('outside')).click();
    await waitFor(() => expect(absent('outer')).toBe(true));
    expect(reasons).toEqual(['outside-press']);
  });

  test.each([1, 2])(
    "a press in a `'trap-focus'` dialog in %i closed shadow roots keeps it open, and a press outside closes it",
    async (levels) => {
      const { shadow, container, find, absent } = closedShadowRoot(levels);
      const reasons: string[] = [];
      mount(
        DialogInShadow,
        {
          nested: 'not modal',
          outerTo: shadow,
          root: {
            modal: 'trap-focus',
            onOpenChange: (_open: boolean, details: DialogRootChangeEventDetails) =>
              reasons.push(details.reason),
          },
        },
        container,
      );
      // A `'trap-focus'` dialog with no backdrop closes at the `pointerdown` of a press outside. The
      // right end of the popup is free of its trigger.
      const rect = (await find('outer')).getBoundingClientRect();
      await userEvent.pointer({
        coords: { x: rect.right - 2, y: rect.top + rect.height / 2 },
        keys: '[MouseLeft]',
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(absent('outer')).toBe(false);
      expect(reasons).toEqual([]);
      await press(await find('outside'));
      await waitFor(() => expect(absent('outer')).toBe(true));
      expect(reasons).toEqual(['outside-press']);
    },
  );
});

test('a press on the backdrop of a modal dialog in an open shadow root closes it', async () => {
  const host = document.body.appendChild(document.createElement('div'));
  onTestFinished(() => host.remove());
  const shadow = host.attachShadow({ mode: 'open' });
  const reasons: string[] = [];
  mount(DialogParts, {
    root: {
      defaultOpen: true,
      onOpenChange: (_open: boolean, details: DialogRootChangeEventDetails) =>
        reasons.push(details.reason),
    },
    portal: { to: shadow },
    backdrop: { style: 'position: fixed; inset: 0' },
  });
  await waitFor(() => expect(shadow.querySelector('[data-testid="backdrop"]')).not.toBe(null));
  shadow.querySelector<HTMLElement>('[data-testid="backdrop"]')!.click();
  await waitFor(() => expect(shadow.querySelector('[role="dialog"]')).toBe(null));
  expect(reasons).toEqual(['outside-press']);
});

describe('sibling dialogs', () => {
  test('Escape closes the newest one after an older one mounts its popup again', async () => {
    const scene = reactive({ key: 0 });
    mount(DialogTwoOpen, { scene });
    const first = await opened('a');
    await opened('b');
    scene.key = 1;
    await waitFor(() => expect(byTestId('a')).not.toBe(first));
    expect(document.activeElement).toBe(document.body);
    await userEvent.keyboard('{Escape}');
    await closed('b');
    expect(byTestId('a')).not.toBe(null);
  });

  test('a press in the top one of three modal dialogs closes none of them', async () => {
    const open = reactive<Record<number, boolean>>({ 0: true });
    mount(DialogSiblings, {
      dialogs: [{}, {}, {}],
      scene: { open, set: (index: number, value: boolean) => (open[index] = value) },
    });
    await opened('popup-0');
    await userEvent.click(byTestId('next-0')!);
    await opened('popup-1');
    await userEvent.click(byTestId('next-1')!);
    await opened('popup-2');
    await press(byTestId('next-2')!);
    await new Promise((resolve) => setTimeout(resolve, 50));
    for (const index of [0, 1, 2]) expect(byTestId(`popup-${index}`)).not.toBe(null);
  });
});

describe('nested dialogs', () => {
  test('a dialog counts each dialog above it in three levels, for each open and close', async () => {
    mount(DialogLevels);
    await nextTick();
    await userEvent.click(byTestId('open-0')!);
    const first = await opened('popup-0');
    for (let round = 0; round < 2; round += 1) {
      expect(nestedCount(first)).toBe('0');
      expect(first).not.toHaveAttribute('data-nested-dialog-open');
      await userEvent.click(byTestId('open-1')!);
      const second = await opened('popup-1');
      await waitFor(() => expect(nestedCount(first)).toBe('1'));
      expect(first).toHaveAttribute('data-nested-dialog-open');
      await userEvent.click(byTestId('open-2')!);
      await opened('popup-2');
      await waitFor(() => expect(nestedCount(first)).toBe('2'));
      expect(nestedCount(second)).toBe('1');
      await userEvent.click(byTestId('close-2')!);
      await closed('popup-2');
      await waitFor(() => expect(nestedCount(first)).toBe('1'));
      await userEvent.click(byTestId('close-1')!);
      await closed('popup-1');
      await waitFor(() => expect(nestedCount(first)).toBe('0'));
      expect(first).not.toHaveAttribute('data-nested-dialog-open');
    }
  });

  test('a closed nested dialog that mounts or unmounts changes no count, and the parent with a dialog above it stays open at a press on its backdrop', async () => {
    const scene = reactive({ closed: false });
    const reasons: string[] = [];
    mount(DialogLevels, {
      scene,
      root: {
        defaultOpen: true,
        onOpenChange: (_open: boolean, details: DialogRootChangeEventDetails) =>
          reasons.push(details.reason),
      },
    });
    const first = await opened('popup-0');
    scene.closed = true;
    await nextTick();
    scene.closed = false;
    await nextTick();
    expect(nestedCount(first)).toBe('0');
    await userEvent.click(byTestId('open-1')!);
    await opened('popup-1');
    await waitFor(() => expect(first).toHaveAttribute('data-nested-dialog-open'));
    scene.closed = true;
    await nextTick();
    await nextTick();
    expect(first).toHaveAttribute('data-nested-dialog-open');
    expect(nestedCount(first)).toBe('1');
    // The second popup covers the middle of the view, so the press goes to a corner.
    await userEvent.pointer({ coords: { x: 5, y: 5 }, keys: '[MouseLeft]' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(byTestId('popup-0')).not.toBe(null);
    expect(reasons).toEqual([]);
  });

  test('a parent that opens after its child is above it: Escape and a press on its backdrop close the parent, and its count stays 0', async () => {
    const root = reactive<Props>({ open: false });
    root['onUpdate:open'] = (open: boolean) => (root.open = open);
    const child = reactive<Props>({ defaultOpen: true });
    mount(DialogParts, {
      root,
      backdrop: { style: 'position: fixed; inset: 0' },
      inTree: { root: child },
    });
    await opened('nested-popup');
    for (const close of ['escape', 'backdrop'] as const) {
      root.open = true;
      const parent = await opened('popup');
      await nextTick();
      expect(parent).not.toHaveAttribute('data-nested-dialog-open');
      expect(nestedCount(parent)).toBe('0');
      if (close === 'escape') await userEvent.keyboard('{Escape}');
      else await userEvent.pointer({ coords: { x: 5, y: 5 }, keys: '[MouseLeft]' });
      await closed('popup');
      expect(byTestId('nested-popup')).not.toBe(null);
    }
  });

  test('a parent that closes under its open child and opens again does not count that child', async () => {
    const root = reactive<Props>({ open: true });
    const child = reactive<Props>({ open: false });
    mount(DialogParts, { root, inTree: { root: child } });
    const parent = await opened('popup');
    child.open = true;
    await opened('nested-popup');
    await waitFor(() => expect(parent).toHaveAttribute('data-nested-dialog-open'));
    root.open = false;
    await closed('popup');
    expect(byTestId('nested-popup')).not.toBe(null);
    root.open = true;
    const again = await opened('popup');
    await nextTick();
    expect(again).not.toHaveAttribute('data-nested-dialog-open');
    expect(nestedCount(again)).toBe('0');
  });
});
