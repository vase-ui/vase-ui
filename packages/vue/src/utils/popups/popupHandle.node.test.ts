import { afterEach, describe, expect, it, vi } from 'vitest';
import { computed, createSSRApp, nextTick, reactive, readonly, ref, watchEffect } from 'vue';
import { renderToString } from 'vue/server-renderer';
import {
  PopupHandleFixtureStore,
  createPopupHandleFixture,
} from '../../../test/fixtures/PopupHandleFixture';
import type { PopupHandleFixture } from '../../../test/fixtures/PopupHandleFixture';
import PopupHandleHydration from './PopupHandleHydration.test.vue';

describe('BasePopupHandle', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stays inert when two server renders share the handle of a module', async () => {
    // All server requests share the handle of a module.
    const handle = createPopupHandleFixture();
    const render = (props: { defaultOpen?: boolean; defaultTriggerId?: string }) =>
      renderToString(createSSRApp(PopupHandleHydration, { handle, ...props }));

    const [open, closed] = await Promise.all([
      render({ defaultOpen: true, defaultTriggerId: 'inside' }),
      render({}),
    ]);

    expect(open).toContain('aria-expanded="true"');
    expect(closed).not.toContain('aria-expanded="true"');
    expect(handle.store).toBe(handle.fallback);
    expect(handle.isOpen).toBe(false);
  });

  it('lets a computed that reads isOpen follow the attached root and its open state', () => {
    const handle = createPopupHandleFixture();
    const rootStore = new PopupHandleFixtureStore();
    const isOpen = computed(() => handle.isOpen);
    expect(isOpen.value).toBe(false);

    const detach = handle.attachStore(rootStore);
    rootStore.set('open', true);
    expect(isOpen.value).toBe(true);

    detach();
    expect(isOpen.value).toBe(false);
  });

  // The `data` option gives a handle as a key of a reactive object.
  it.each([
    { name: 'ref()', hold: (handle: PopupHandleFixture) => ref(handle).value },
    { name: 'reactive()', hold: (handle: PopupHandleFixture) => reactive(handle) },
    { name: 'readonly()', hold: (handle: PopupHandleFixture) => readonly(handle) },
    {
      name: 'a key of a reactive object',
      hold: (handle: PopupHandleFixture) => reactive({ handle }).handle,
    },
  ])('controls its root when the consumer holds the handle in $name', ({ hold }) => {
    const handle = createPopupHandleFixture();
    const rootStore = new PopupHandleFixtureStore();
    const held = hold(handle);

    const detach = held.attachStore(rootStore);
    expect(handle.store).toBe(rootStore);

    held.open(null);
    expect(held.isOpen).toBe(true);
    held.close();
    expect(held.isOpen).toBe(false);
    expect(() => {
      held.open('missing');
    }).toThrow('FixtureHandle.open() was called with the trigger id "missing"');

    detach();
    expect(handle.store).toBe(handle.fallback);
  });

  it('lets an effect call open() and close() with no dependency on the attached root', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handle = createPopupHandleFixture();
    const detach = handle.attachStore(new PopupHandleFixtureStore());
    const effect = vi.fn(() => {
      handle.open(null);
      handle.close();
    });
    const stop = watchEffect(effect);
    expect(effect).toHaveBeenCalledTimes(1);

    detach();
    await nextTick();
    handle.attachStore(new PopupHandleFixtureStore());
    await nextTick();
    stop();

    expect(effect).toHaveBeenCalledTimes(1);
    expect(consoleWarn).not.toHaveBeenCalled();
  });
});
