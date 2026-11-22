import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import { Dialog, type DialogRootChangeEventDetails } from '@vase-ui/vue/dialog';
import DialogHandleScene from '../../test/fixtures/DialogHandleScene.vue';
import DialogHandles from '../../test/fixtures/DialogHandles.vue';
import DialogParts from '../../test/fixtures/DialogParts.vue';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Handle = InstanceType<typeof Dialog.Handle>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const byId = (id: string) => document.getElementById(id)!;

async function opened(id: string) {
  await waitFor(() => expect(byTestId(id)).not.toBe(null));
  return byTestId(id)!;
}

async function closed(id: string) {
  await waitFor(() => expect(byTestId(id)).toBe(null));
}

/** Expects that the trigger is the active one of the open popup. */
function expectActive(trigger: HTMLElement, popup: HTMLElement) {
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  expect(trigger).toHaveAttribute('aria-controls', popup.id);
}

function expectInactive(trigger: HTMLElement) {
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(trigger).not.toHaveAttribute('aria-controls');
}

function handleScene(scene: {
  triggerHandle?: Handle;
  rootHandle?: Handle | undefined;
  roots?: string[];
  triggers?: string[];
  payloads?: Record<string, unknown>;
  triggersAfter?: boolean;
}) {
  const handle = scene.triggerHandle ?? Dialog.createHandle();
  return reactive({
    triggerHandle: handle,
    rootHandle: 'rootHandle' in scene ? scene.rootHandle : handle,
    roots: scene.roots ?? ['r'],
    triggers: scene.triggers ?? ['a', 'b'],
    payloads: scene.payloads ?? { a: 'A', b: 'B' },
    section: false,
    triggersAfter: scene.triggersAfter ?? false,
  });
}

const nonModal = { modal: false, disablePointerDismissal: true };

describe('a root that changes its handle', () => {
  test('keeps its open popup, and the new handle and its triggers control it', async () => {
    const first = Dialog.createHandle();
    const second = Dialog.createHandle();
    const scene = handleScene({ triggerHandle: first });
    mount(DialogHandleScene, { scene, root: nonModal });
    await nextTick();
    await userEvent.click(byId('a'));
    const popup = await opened('popup-r');
    // The triggers and the root move to the second handle together.
    scene.triggerHandle = second;
    scene.rootHandle = second;
    await nextTick();
    expect(byTestId('popup-r')).toBe(popup);
    expect([second.isOpen, first.isOpen]).toEqual([true, false]);
    await waitFor(() => expectActive(byId('a'), popup));
    scene.triggerHandle = first;
    scene.rootHandle = first;
    await nextTick();
    expect([first.isOpen, second.isOpen]).toEqual([true, false]);
    first.close();
    await closed('popup-r');
  });

  test('resolves no trigger of the handle that it left', async () => {
    const first = Dialog.createHandle();
    const second = Dialog.createHandle();
    const scene = handleScene({ triggerHandle: first });
    mount(DialogHandleScene, { scene, root: nonModal });
    await nextTick();
    first.open('a');
    await waitFor(() => expectActive(byId('a'), byTestId('popup-r')!));
    first.close();
    await closed('popup-r');
    scene.rootHandle = second;
    await nextTick();
    second.open('a');
    await opened('popup-r');
    expect(byTestId('payload-r')).toHaveTextContent('');
    expectInactive(byId('a'));
  });

  test('a root that gets a handle while open opens from it, and one that loses it does not', async () => {
    const handle = Dialog.createHandle();
    const scene = handleScene({ triggerHandle: handle, rootHandle: undefined });
    mount(DialogHandleScene, { scene, root: nonModal });
    await nextTick();
    handle.open('a');
    await nextTick();
    expect(byTestId('popup-r')).toBe(null);
    scene.rootHandle = handle;
    await nextTick();
    handle.open('a');
    const popup = await opened('popup-r');
    expectActive(byId('a'), popup);
    handle.close();
    await closed('popup-r');
    scene.rootHandle = undefined;
    await nextTick();
    handle.open('a');
    await nextTick();
    expect([handle.isOpen, byTestId('popup-r')]).toEqual([false, null]);
  });

  test('a new handle for the triggers and the root of an open dialog keeps aria-controls', async () => {
    const scene = handleScene({});
    mount(DialogHandleScene, { scene, root: { ...nonModal, open: true, triggerId: 'a' } });
    const popup = await opened('popup-r');
    await waitFor(() => expectActive(byId('a'), popup));
    const next = Dialog.createHandle();
    scene.triggerHandle = next;
    scene.rootHandle = next;
    await waitFor(() => expectActive(byId('a'), byTestId('popup-r')!));
  });
});

describe('roots that share a handle', () => {
  test('a newer root that unmounts gives the handle back to the older one', async () => {
    const scene = handleScene({ roots: ['older'] });
    mount(DialogHandleScene, { scene });
    await nextTick();
    scene.roots = ['older', 'newer'];
    await nextTick();
    scene.roots = ['older'];
    await nextTick();
    scene.triggerHandle.open(null);
    await opened('popup-older');
    expect(scene.triggerHandle.isOpen).toBe(true);
  });

  test('a root that mounts while the older one is mounted, and opens by id at its mount, keeps the trigger after the older root goes', async () => {
    const scene = handleScene({ roots: ['older'] });
    let mounts = 0;
    mount(DialogHandleScene, {
      scene,
      root: nonModal,
      atMount: () => {
        mounts += 1;
        if (mounts === 2) scene.triggerHandle.open('b');
      },
    });
    await nextTick();
    scene.roots = ['older', 'newer'];
    const popup = await opened('popup-newer');
    expectActive(byId('b'), popup);
    expectInactive(byId('a'));
    scene.roots = ['newer'];
    await nextTick();
    expect(scene.triggerHandle.isOpen).toBe(true);
    expectActive(byId('b'), byTestId('popup-newer')!);
  });
});

describe('a root that mounts again', () => {
  test('after an unmount while open starts closed, and a trigger that stayed opens it with aria-controls, also by id', async () => {
    const scene = handleScene({});
    mount(DialogHandleScene, { scene });
    await nextTick();
    await userEvent.click(byId('a'));
    await waitFor(() => expectActive(byId('a'), byTestId('popup-r')!));
    scene.roots = [];
    await closed('popup-r');
    scene.roots = ['r'];
    await nextTick();
    expect(byTestId('popup-r')).toBe(null);
    expectInactive(byId('a'));
    await userEvent.click(byId('a'));
    await waitFor(() => expectActive(byId('a'), byTestId('popup-r')!));
    expectInactive(byId('b'));
    scene.roots = [];
    await closed('popup-r');
    scene.roots = ['r'];
    await nextTick();
    scene.triggerHandle.open('b');
    const popup = await opened('popup-r');
    expectActive(byId('b'), popup);
    expect(byTestId('payload-r')).toHaveTextContent('B');
  });
});

describe('the triggers', () => {
  test('a trigger that mounts after the root and triggers that mount again in another element open the popup', async () => {
    const scene = handleScene({ triggersAfter: true });
    mount(DialogHandleScene, { scene });
    await nextTick();
    await userEvent.click(byId('b'));
    const popup = await opened('popup-r');
    expectActive(byId('b'), popup);
    await userEvent.keyboard('{Escape}');
    await closed('popup-r');
    for (const section of [true, false]) {
      scene.section = section;
      await nextTick();
      await userEvent.click(byId('a'));
      await waitFor(() => expectActive(byId('a'), byTestId('popup-r')!));
      await userEvent.keyboard('{Escape}');
      await closed('popup-r');
      expectInactive(byId('a'));
    }
  });

  test('a new handle for the triggers and the root keeps the triggers working', async () => {
    const scene = handleScene({});
    mount(DialogHandleScene, { scene });
    await nextTick();
    for (let round = 0; round < 2; round += 1) {
      const next = Dialog.createHandle();
      scene.triggerHandle = next;
      scene.rootHandle = next;
      scene.section = round === 1;
      await nextTick();
      await userEvent.click(byId('a'));
      await waitFor(() => expectActive(byId('a'), byTestId('popup-r')!));
      await userEvent.keyboard('{Escape}');
      await closed('popup-r');
    }
  });

  test('the slot follows a change of the payload of the active trigger while the popup is open', async () => {
    const scene = handleScene({});
    mount(DialogHandleScene, { scene, root: nonModal });
    await nextTick();
    await userEvent.click(byId('a'));
    await waitFor(() => expect(byTestId('payload-r')).toHaveTextContent('A'));
    scene.payloads = { a: 'A2', b: 'B2' };
    await waitFor(() => expect(byTestId('payload-r')).toHaveTextContent('A2'));
  });

  test('a trigger in the root updates the payload of the open popup', async () => {
    const triggers = reactive([
      { key: 'a', attrs: { id: 'a', payload: 1 } },
      { key: 'b', attrs: { id: 'b', payload: 2 } },
    ]);
    mount(DialogParts, { root: { modal: false }, triggers });
    await nextTick();
    await userEvent.click(byId('a'));
    await waitFor(() => expect(byTestId('payload')).toHaveTextContent('1'));
    triggers[0]!.attrs.payload = 8;
    await waitFor(() => expect(byTestId('payload')).toHaveTextContent('8'));
  });

  test('a press on another trigger moves the same popup element to it', async () => {
    const scene = handleScene({});
    mount(DialogHandleScene, { scene, root: nonModal });
    await nextTick();
    await userEvent.click(byId('a'));
    const popup = await opened('popup-r');
    await userEvent.click(byId('b'));
    await waitFor(() => expect(byTestId('payload-r')).toHaveTextContent('B'));
    expect(byTestId('popup-r')).toBe(popup);
    expectActive(byId('b'), popup);
    expectInactive(byId('a'));
  });

  test('after the active trigger unmounts, a close has no trigger', async () => {
    const triggers: unknown[] = [];
    const scene = handleScene({});
    mount(DialogHandleScene, {
      scene,
      root: {
        modal: false,
        onOpenChange: (_: boolean, details: DialogRootChangeEventDetails) =>
          triggers.push(details.trigger),
      },
    });
    await nextTick();
    await userEvent.click(byId('b'));
    await opened('popup-r');
    scene.triggers = ['a'];
    await nextTick();
    await userEvent.keyboard('{Escape}');
    await closed('popup-r');
    expect(triggers.at(-1)).toBe(undefined);
  });

  test('a controlled `triggerId` and a `defaultTriggerId` that is not the first mark that trigger', async () => {
    for (const root of [
      { open: true, triggerId: 'b' },
      { defaultOpen: true, defaultTriggerId: 'b' },
    ]) {
      const scene = handleScene({ triggers: ['a', 'b', 'c'] });
      const { unmount } = mount(DialogHandleScene, { scene, root: { ...nonModal, ...root } });
      const popup = await opened('popup-r');
      await waitFor(() => expectActive(byId('b'), popup));
      expect(byTestId('payload-r')).toHaveTextContent('B');
      expectInactive(byId('a'));
      expectInactive(byId('c'));
      unmount();
    }
  });

  test('open(id) in the `onMounted` of a child of the root marks that trigger', async () => {
    const handle = Dialog.createHandle<string>();
    mount(DialogHandles, { handle, atMount: () => handle.open('second') });
    const popup = await opened('popup');
    await waitFor(() => expectActive(byId('second'), popup));
    expectInactive(byId('first'));
    expect(byTestId('payload')).toHaveTextContent('second');
  });

  test('openWithPayload() leaves each trigger inactive', async () => {
    const handle = Dialog.createHandle<string>();
    mount(DialogHandles, { handle });
    await nextTick();
    handle.openWithPayload('given');
    await opened('popup');
    expectInactive(byId('first'));
    expectInactive(byId('second'));
  });
});
