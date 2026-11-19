import { afterEach, beforeEach, describe, expect, onTestFinished, test, vi } from 'vitest';
import { nextTick, reactive } from 'vue';
import AvatarElementReplaced from '../../test/fixtures/AvatarElementReplaced.vue';
import AvatarInTransition from '../../test/fixtures/AvatarInTransition.vue';
import AvatarPartOutsideRoot from '../../test/fixtures/AvatarPartOutsideRoot.vue';
import AvatarParts from '../../test/fixtures/AvatarParts.vue';
import {
  nextFrame,
  pictureThatBrowserHas,
  pictureThatFails,
  pictureThatMustLoad,
  recordImageObjects,
} from '../../test/pictures';
import { takeReportedMessages } from '../../test/reportedMessages';
import { mount, mountError, settle } from '../../test/render';
import { waitFor } from '../../test/waitFor';

/** Mounts the three parts. `events` gets each `loadingStatusChange` of the image. */
function mountAvatar(image: Record<string, unknown> = {}, props: Record<string, unknown> = {}) {
  const events: string[] = [];
  const attrs = reactive<Record<string, unknown>>({
    onLoadingStatusChange: (status: string) => events.push(status),
    ...image,
  });
  const { root, exposed } = mount(AvatarParts, { image: attrs, ...props });
  const avatar = root.firstElementChild as HTMLElement;
  return {
    avatar,
    exposed,
    events,
    image: attrs,
    img: () => avatar.querySelector('img'),
    fallback: () => avatar.querySelector('span'),
    status: () => avatar.querySelector('.status')!.textContent,
  };
}

/**
 * Waits for the update that a new source of a kept element starts: the observer reads the element
 * after the patch, and the next update renders the status.
 */
async function sourceUpdate() {
  await nextTick();
  await nextTick();
}

/** The attributes of `element` that the part writes while the picture is not loaded. */
function notLoadedAttributes(element: Element) {
  return ['data-loading', 'data-error', 'aria-hidden'].filter((name) => element.hasAttribute(name));
}

describe('the parts', () => {
  test('the root is a span with the attributes of the developer and the state in its slot, with no state attribute', async () => {
    const onClick = vi.fn();
    const { avatar, exposed, status } = mountAvatar(
      {},
      { root: { class: 'Avatar', 'data-kind': 'person', onClick }, scene: { image: false } },
    );
    await nextTick();
    expect(avatar.localName).toBe('span');
    expect(avatar.getAttributeNames().sort()).toEqual(['class', 'data-kind']);
    expect(exposed.root.element).toBe(avatar);
    avatar.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(status()).toBe('idle');
  });

  test('the image is an img with the attributes of the developer and the five request attributes', async () => {
    const picture = await pictureThatBrowserHas();
    const { img, exposed } = mountAvatar({
      class: 'Image',
      'data-kind': 'person',
      crossorigin: 'anonymous',
      referrerpolicy: 'no-referrer',
      sizes: '2px',
      srcset: `${picture} 2w`,
      src: picture,
    });
    await waitFor(() => expect(img()).not.toBeNull());
    expect(exposed.image.element).toBe(img());
    expect(
      Object.fromEntries(
        img()!
          .getAttributeNames()
          .map((name) => [name, img()!.getAttribute(name)]),
      ),
    ).toEqual({
      alt: '',
      class: 'Image',
      'data-kind': 'person',
      crossorigin: 'anonymous',
      referrerpolicy: 'no-referrer',
      sizes: '2px',
      srcset: `${picture} 2w`,
      src: picture,
    });
  });

  test('the image has an empty alt by default, also for undefined and null, and the alt of the developer wins', async () => {
    const { img, image } = mountAvatar({ src: await pictureThatBrowserHas() });
    await nextTick();
    expect(img()).toHaveAttribute('alt', '');
    for (const [alt, expected] of [
      ['Jane Doe', 'Jane Doe'],
      [undefined, ''],
      [null, ''],
    ]) {
      image.alt = alt;
      await nextTick();
      expect(img()).toHaveAttribute('alt', expected);
    }
  });

  test('the fallback is a span with the attributes of the developer and the state in its slot', async () => {
    const { fallback, exposed } = mountAvatar(
      {},
      { fallback: { class: 'Fallback', 'data-kind': 'person' }, scene: { image: false } },
    );
    await nextTick();
    expect(fallback()!.getAttributeNames().sort()).toEqual(['class', 'data-kind']);
    expect(exposed.fallback.element).toBe(fallback());
    expect(fallback()).toHaveTextContent('JD idle');
  });

  test('the element slot of each part renders the element of the developer, and the props of the image have no alt', async () => {
    const { root } = mount(AvatarElementReplaced, {
      kind: 'own-source',
      scene: { picture: await pictureThatMustLoad() },
      image: { keepMounted: true },
    });
    await nextTick();
    const avatar = root.querySelector('.Root')!;
    const img = avatar.querySelector('img')!;
    expect(avatar.localName).toBe('div');
    expect(avatar).toHaveAttribute('data-status', 'loading');
    expect(img).not.toHaveAttribute('alt');
    expect(avatar.querySelector('i.Fallback')).toHaveTextContent('loading');
    await waitFor(() => expect(img).toHaveAttribute('data-status', 'loaded'));
    expect(avatar.querySelector('i')).toBeNull();
  });
});

describe('the status and its event', () => {
  test('a picture that must load gives loading, then loaded, and one of the image and the fallback is in the DOM', async () => {
    const { img, fallback, status, events } = mountAvatar({ src: await pictureThatMustLoad() });
    await nextTick();
    expect(events).toEqual(['loading']);
    expect(img()).toBeNull();
    expect(fallback()).toHaveTextContent('JD loading');
    await waitFor(() => expect(img()).not.toBeNull());
    expect(fallback()).toBeNull();
    expect(status()).toBe('loaded');
    expect(events).toEqual(['loading', 'loaded']);
  });

  test('a picture that fails gives loading, then error', async () => {
    const { img, fallback, events } = mountAvatar({ src: pictureThatFails() });
    await waitFor(() => expect(fallback()).toHaveTextContent('JD error'));
    expect(img()).toBeNull();
    expect(events).toEqual(['loading', 'error']);
  });

  test.each([false, true])(
    'no source gives error only, though the browser sends no event (keepMounted: %s)',
    async (keepMounted) => {
      const { img, fallback, events } = mountAvatar({ keepMounted });
      await settle();
      expect(events).toEqual(['error']);
      expect(fallback()).toHaveTextContent('JD error');
      expect(img()?.hasAttribute('data-error') ?? false).toBe(keepMounted);
    },
  );

  test.each([
    { source: 'src', keepMounted: false },
    { source: 'src', keepMounted: true },
    { source: 'srcset', keepMounted: false },
    { source: 'srcset', keepMounted: true },
  ])(
    'a picture from $source that the browser has is loaded before the first paint, with no other status (keepMounted: $keepMounted)',
    async ({ source, keepMounted }) => {
      const picture = await pictureThatBrowserHas();
      const sources =
        source === 'src' ? { src: picture } : { sizes: '2px', srcset: `${picture} 2w` };
      const { img, fallback, events } = mountAvatar({ keepMounted, ...sources });
      if (source === 'src') {
        await nextTick();
        expect(fallback()).toBeNull();
      }
      await nextFrame();
      expect(fallback()).toBeNull();
      expect(notLoadedAttributes(img()!)).toEqual([]);
      expect(events).toEqual(['loaded']);
    },
  );
});

describe('without keepMounted', () => {
  test('an image outside the document gets the request attributes, the sources last, and a new one for each change', async () => {
    const images = recordImageObjects();
    const picture = await pictureThatMustLoad();
    const { img, fallback, image } = mountAvatar({
      src: picture,
      srcset: `${picture} 2w`,
      sizes: '2px',
      referrerpolicy: 'no-referrer',
      crossorigin: 'anonymous',
      loading: 'lazy',
    });
    await nextTick();
    expect(images).toHaveLength(1);
    expect(images[0]!.getAttributeNames()).toEqual([
      'crossorigin',
      'referrerpolicy',
      'sizes',
      'srcset',
      'src',
    ]);
    expect(img()).toBeNull();
    image.referrerpolicy = 'origin';
    await nextTick();
    expect(images).toHaveLength(2);
    expect(images[1]!.referrerPolicy).toBe('origin');
    await waitFor(() => expect(img()).not.toBeNull());
    expect(fallback()).toBeNull();
    expect(img()).toHaveAttribute('loading', 'lazy');
    expect(notLoadedAttributes(img()!)).toEqual([]);
  });

  test('a new source that the browser has keeps the element with no event; one that must load shows the fallback', async () => {
    const { img, fallback, image, events } = mountAvatar({ src: await pictureThatBrowserHas() });
    await nextTick();
    const loaded = img();
    image.src = await pictureThatBrowserHas();
    await nextTick();
    expect(img()).toBe(loaded);
    expect(img()).toHaveAttribute('src', image.src as string);
    expect(events).toEqual(['loaded']);
    image.src = await pictureThatMustLoad();
    await nextTick();
    expect(img()).toBeNull();
    expect(fallback()).toHaveTextContent('JD loading');
    await waitFor(() => expect(img()).toHaveAttribute('src', image.src as string));
    expect(events).toEqual(['loaded', 'loading', 'loaded']);
  });

  test('the load of an image that a new source replaced does not change the status', async () => {
    const first = await pictureThatMustLoad();
    const { fallback, image, events } = mountAvatar({ src: first });
    await nextTick();
    image.src = pictureThatFails();
    await waitFor(() => expect(fallback()).toHaveTextContent('JD error'));
    // The first picture has loaded when another image has it.
    await new Promise((resolve) => Object.assign(new Image(), { src: first, onload: resolve }));
    await settle();
    expect(events).toEqual(['loading', 'error']);
  });
});

describe('with keepMounted', () => {
  test('the element loads the picture in place, with data-loading and aria-hidden until the load; the listener of the developer runs once', async () => {
    const images = recordImageObjects();
    const onLoad = vi.fn();
    const { img, fallback, events } = mountAvatar({
      keepMounted: true,
      alt: 'Jane Doe',
      src: await pictureThatMustLoad(),
      onLoad,
    });
    await nextTick();
    expect(images).toHaveLength(0);
    expect(notLoadedAttributes(img()!)).toEqual(['data-loading', 'aria-hidden']);
    expect(img()).toHaveAttribute('aria-hidden', 'true');
    expect(fallback()).toHaveTextContent('JD loading');
    await waitFor(() => expect(fallback()).toBeNull());
    expect(notLoadedAttributes(img()!)).toEqual([]);
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(events).toEqual(['loading', 'loaded']);
  });

  test('a picture that fails keeps the element with data-error and aria-hidden; the listener of the developer runs once', async () => {
    const onError = vi.fn();
    const { img, fallback } = mountAvatar({ keepMounted: true, src: pictureThatFails(), onError });
    await waitFor(() => expect(fallback()).toHaveTextContent('JD error'));
    expect(notLoadedAttributes(img()!)).toEqual(['data-error', 'aria-hidden']);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  test('an aria-hidden of the developer wins in each status', async () => {
    const { img, fallback } = mountAvatar({
      keepMounted: true,
      'aria-hidden': 'false',
      src: await pictureThatMustLoad(),
    });
    await nextTick();
    expect(img()).toHaveAttribute('aria-hidden', 'false');
    await waitFor(() => expect(fallback()).toBeNull());
    expect(img()).toHaveAttribute('aria-hidden', 'false');
  });

  test('a new src reads the element again: loading, data-loading, aria-hidden and the fallback, then loaded', async () => {
    const next = await pictureThatMustLoad();
    const { img, fallback, image, events } = mountAvatar({
      keepMounted: true,
      src: await pictureThatBrowserHas(),
    });
    await nextTick();
    image.src = next;
    await sourceUpdate();
    expect(notLoadedAttributes(img()!)).toEqual(['data-loading', 'aria-hidden']);
    expect(fallback()).toHaveTextContent('JD loading');
    await waitFor(() => expect(fallback()).toBeNull());
    expect(events).toEqual(['loaded', 'loading', 'loaded']);
  });

  test('a load event of a source that a new source replaced gives no loaded status (Firefox sends one)', async () => {
    const next = await pictureThatMustLoad();
    const { img, image } = mountAvatar({ keepMounted: true, src: await pictureThatBrowserHas() });
    // In the task of the mount, so the load event of the first source is still to come.
    const statuses: [string, boolean][] = [];
    image.onLoadingStatusChange = (status: string) => statuses.push([status, img()!.complete]);
    image.src = next;
    await waitFor(() => expect(statuses.at(-1)).toEqual(['loaded', true]));
    await settle();
    expect(statuses).toEqual([
      ['loading', false],
      ['loaded', true],
    ]);
  });

  test('the request attributes come before the attributes of the developer, and the sources after them', async () => {
    const picture = await pictureThatMustLoad();
    const { img } = mountAvatar({
      keepMounted: true,
      src: picture,
      srcset: `${picture} 2w`,
      sizes: '2px',
      loading: 'lazy',
      referrerpolicy: 'no-referrer',
      crossorigin: 'anonymous',
    });
    await nextTick();
    // WebKit starts the request when `src` is set, and ignores a later `loading` (measurement M3).
    const names = ['crossorigin', 'referrerpolicy', 'loading', 'sizes', 'srcset', 'src'];
    expect(
      img()!
        .getAttributeNames()
        .filter((name) => names.includes(name)),
    ).toEqual(names);
  });
});

describe('the element slot with keepMounted', () => {
  /** Mounts the slot of `kind` with a picture that the browser has, and waits for the status. */
  async function mountSlot(kind: string, picture?: string) {
    const scene = reactive({ picture: picture ?? (await pictureThatBrowserHas()) });
    const events: string[] = [];
    const image = reactive<Record<string, unknown>>({
      keepMounted: true,
      onLoadingStatusChange: (status: string) => events.push(status),
    });
    const { root } = mount(AvatarElementReplaced, { kind, scene, image });
    const avatar = root.querySelector('.Root')!;
    return {
      scene,
      image,
      events,
      img: () => avatar.querySelector('img')!,
      fallback: () => avatar.querySelector('i'),
    };
  }

  test('the part follows an img that sets its own source and keeps that source; another change reads nothing', async () => {
    const { scene, image, events, img } = await mountSlot('own-source');
    await settle();
    const element = img();
    expect(element).toHaveAttribute('src', scene.picture);
    image.class = 'Changed';
    await settle();
    expect(element).toHaveClass('Changed');
    expect(events).toEqual(['loaded']);
    scene.picture = await pictureThatMustLoad();
    await sourceUpdate();
    expect(element).toHaveAttribute('data-loading');
    await waitFor(() => expect(events).toEqual(['loaded', 'loading', 'loaded']));
  });

  test.each(['keyed', 'component'])(
    'the part reads a new element, and follows the source of a component (%s)',
    async (kind) => {
      const { scene, events, img, fallback } = await mountSlot(kind);
      await settle();
      const first = img();
      scene.picture = await pictureThatMustLoad();
      await sourceUpdate();
      expect(img() !== first).toBe(kind === 'keyed');
      expect(notLoadedAttributes(img())).toEqual(['data-loading', 'aria-hidden']);
      expect(fallback()).toHaveTextContent('loading');
      await waitFor(() => expect(fallback()).toBeNull());
      expect(events).toEqual(['loaded', 'loading', 'loaded']);
    },
  );

  test('the load of an element that the slot replaced does not change the status', async () => {
    const { scene, events, img, fallback } = await mountSlot('keyed', await pictureThatMustLoad());
    const replaced = img();
    const replacedLoad = new Promise((resolve) => replaced.addEventListener('load', resolve));
    scene.picture = pictureThatFails();
    await waitFor(() => expect(fallback()).toHaveTextContent('error'));
    await replacedLoad;
    await settle();
    expect(events).toEqual(['loading', 'error']);
  });

  test('a component that gives no element sets the status through its load and error events only', async () => {
    const { scene, events, fallback } = await mountSlot('no-element', await pictureThatMustLoad());
    await nextTick();
    expect(fallback()).toHaveTextContent('idle');
    await waitFor(() => expect(fallback()).toBeNull());
    scene.picture = pictureThatFails();
    await waitFor(() => expect(fallback()).toHaveTextContent('error'));
    expect(events).toEqual(['loaded', 'error']);
  });
});

describe('the fallback and its delay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Mounts a root with no image, and a fallback with the attributes `fallback`. */
  function mountFallback(fallback: Record<string, unknown>, scene = reactive({ image: false })) {
    const attrs = reactive(fallback);
    return { attrs, ...mountAvatar({}, { fallback: attrs, scene }) };
  }

  async function advance(time: number) {
    vi.advanceTimersByTime(time);
    await nextTick();
  }

  test('in a root with no image, the fallback shows when its delay is over; the wait starts at the mount', async () => {
    const { fallback } = mountFallback({ delay: 100 });
    await advance(99);
    expect(fallback()).toBeNull();
    await advance(1);
    expect(fallback()).toHaveTextContent('JD idle');
  });

  test('a delay of 0 shows the fallback in the first render, and a delay that becomes 0 shows it at once', async () => {
    expect(mountFallback({}).fallback()).not.toBeNull();
    const { attrs, fallback } = mountFallback({ delay: 100 });
    await nextTick();
    expect(fallback()).toBeNull();
    attrs.delay = 0;
    await nextTick();
    expect(fallback()).not.toBeNull();
  });

  test.each([
    { name: 'undefined, then 100', delays: [undefined, 100] },
    { name: '100, then undefined, then 100', delays: [100, undefined, 100] },
  ])(
    'a later change of the delay does not hide a fallback that shows ($name)',
    async ({ delays }) => {
      const { attrs, fallback } = mountFallback({ delay: delays[0] });
      for (const delay of delays.slice(1)) {
        attrs.delay = delay;
        await nextTick();
      }
      expect(fallback()).not.toBeNull();
    },
  );

  test('a new delay above 0 during the wait starts the wait again', async () => {
    const { attrs, fallback } = mountFallback({ delay: 100 });
    await advance(50);
    attrs.delay = 200;
    await nextTick();
    await advance(199);
    expect(fallback()).toBeNull();
    await advance(1);
    expect(fallback()).not.toBeNull();
  });

  test('a picture that loads before the delay shows with no fallback; after the delay, the fallback shows at once', async () => {
    const scene = reactive({ image: true });
    const { fallback, img } = mountAvatar(
      { src: await pictureThatBrowserHas() },
      { fallback: { delay: 100 }, scene },
    );
    await nextTick();
    expect(img()).not.toBeNull();
    await advance(100);
    expect(fallback()).toBeNull();
    scene.image = false;
    await nextTick();
    expect(fallback()).toHaveTextContent('JD idle');
  });

  test('a fallback that unmounts during its wait leaves no timer', async () => {
    const scene = reactive({ image: false, fallback: true });
    mountFallback({ delay: 100 }, scene);
    // A Vue app in development mode can have a timer of its own.
    const timers = vi.getTimerCount();
    scene.fallback = false;
    await nextTick();
    expect(vi.getTimerCount()).toBe(timers - 1);
  });
});

test('Transition gives its enter classes to the image and its leave classes to the fallback, out of the flow', async () => {
  let loaded!: () => void;
  const picture = await pictureThatMustLoad();
  const { root } = mount(AvatarInTransition, {
    image: {
      src: picture,
      onLoadingStatusChange: (status: string) => status === 'loaded' && loaded(),
    },
  });
  await new Promise<void>((resolve) => (loaded = resolve));
  await nextTick();
  const avatar = root.firstElementChild!;
  expect(avatar.querySelector('img')).toHaveClass('v-enter-from', 'v-enter-active');
  const fallback = avatar.querySelector('span')!;
  expect(fallback).toHaveClass('v-leave-from', 'v-leave-active');
  expect(getComputedStyle(fallback).position).toBe('absolute');
});

describe('lifetime', () => {
  test('an image that unmounts gives the status idle with no event, and its picture that loads later changes nothing', async () => {
    const scene = reactive({ image: true });
    const { img, fallback, status, events } = mountAvatar(
      { keepMounted: true, src: await pictureThatMustLoad() },
      { scene },
    );
    await nextTick();
    const element = img()!;
    const load = new Promise((resolve) => element.addEventListener('load', resolve));
    scene.image = false;
    await nextTick();
    expect(status()).toBe('idle');
    await load;
    await settle();
    expect(fallback()).toHaveTextContent('JD idle');
    expect(events).toEqual(['loading']);
  });

  test('an image that unmounts leaves no observer', async () => {
    const observed = new Set<MutationObserver>();
    const BrowserObserver = MutationObserver;
    vi.stubGlobal(
      'MutationObserver',
      class extends BrowserObserver {
        override observe(target: Node, options?: MutationObserverInit) {
          if (target instanceof HTMLImageElement) observed.add(this);
          super.observe(target, options);
        }
        override disconnect() {
          observed.delete(this);
          super.disconnect();
        }
      },
    );
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
    const scene = reactive({ image: true });
    mountAvatar({ keepMounted: true, src: await pictureThatBrowserHas() }, { scene });
    await nextTick();
    expect(observed.size).toBe(1);
    scene.image = false;
    await nextTick();
    expect(observed.size).toBe(0);
  });
});

// The last case, because the part throws in `setup`.
test('a part outside a root throws', () => {
  expect(String(mountError(AvatarPartOutsideRoot))).toContain(
    'Vase UI Avatar: <Avatar.Image> must be inside <Avatar.Root>.',
  );
  // After the error, Vapor renders the part with no setup, and warns about each binding.
  takeReportedMessages();
});
