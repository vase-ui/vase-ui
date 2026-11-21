// Measurements with native elements and plain Vue, with no code of the library. Each one states
// what the browser or Vue does, so that a part has code only where they do not do it.
import { afterEach, describe, expect, test } from 'vitest';
import { server } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import MeasureImage from '../fixtures/MeasureImage.vue';
import { nextFrame, pictureThatBrowserHas, pictureThatMustLoad } from '../pictures';
import { mount } from '../render';

let root: HTMLElement | undefined;

function html(markup: string) {
  root = document.body.appendChild(document.createElement('div'));
  root.innerHTML = markup;
  return root;
}

afterEach(() => {
  root?.remove();
  root = undefined;
});

const read = (image: HTMLImageElement) => ({
  complete: image.complete,
  loaded: image.naturalWidth > 0,
});
const microtask = () => new Promise<void>((resolve) => queueMicrotask(resolve));
const event = (target: EventTarget, type: string) =>
  new Promise<void>((resolve) => target.addEventListener(type, () => resolve(), { once: true }));

/** A URL of the test server for a picture, which no request of the page has asked for. */
function newServerUrl(name: string) {
  return new URL(`/test/fixtures/picture.svg?${name}-${Math.random()}`, location.href).href;
}

/** The requests of the page for `urls`. The test clears the earlier requests first. */
function requested(...urls: string[]) {
  return performance
    .getEntriesByType('resource')
    .map(({ name }) => name)
    .filter((name) => urls.includes(name));
}

describe('a picture that the document has', () => {
  test.each(['an image object', 'an img of Vue'])(
    'from src, %s is complete in the same task',
    async (kind) => {
      const url = await pictureThatBrowserHas();
      const image =
        kind === 'an image object'
          ? Object.assign(new Image(), { src: url })
          : mount(MeasureImage, { attrs: { alt: '', src: url } }).root.querySelector('img')!;
      expect(read(image)).toEqual({ complete: true, loaded: true });
    },
  );

  test.each(['an image object', 'an img of Vue'])(
    'from srcset, %s is complete one microtask later in each browser, and in the same task in Chromium and WebKit',
    async (kind) => {
      const url = await pictureThatBrowserHas();
      const sources = { sizes: '2px', srcset: `${url} 2w` };
      const image =
        kind === 'an image object'
          ? Object.assign(new Image(), sources)
          : mount(MeasureImage, { attrs: { alt: '', ...sources } }).root.querySelector('img')!;
      const inSameTask = server.browser !== 'firefox';
      expect(read(image)).toEqual({ complete: inSameTask, loaded: inSameTask });
      await microtask();
      expect(read(image)).toEqual({ complete: true, loaded: true });
    },
  );
});

test('a loaded img that gets a src which the document does not have is not complete, also in a mutation observer', async () => {
  const image = html(`<img alt="" src="${await pictureThatBrowserHas()}">`).querySelector('img')!;
  await event(image, 'load');
  const next = await pictureThatMustLoad();
  const inObserver = new Promise<boolean>((resolve) => {
    new MutationObserver(() => resolve(image.complete)).observe(image, { attributes: true });
  });
  image.src = next;
  expect(image.complete).toBe(false);
  expect(await inObserver).toBe(false);
});

test('WebKit requests src at once in an img that gets src first and lazy, srcset and the request options later, before it is in the document', async () => {
  const [src, candidate, farSrc, farCandidate] = [
    'src',
    'candidate',
    'far-src',
    'far-candidate',
  ].map(newServerUrl) as [string, string, string, string];
  performance.clearResourceTimings();
  // The virtual DOM of Vue sets the attributes in the order of their keys, and then inserts the
  // element.
  const imageOf = (source: string, candidate: string, style = '') => {
    const image = document.createElement('img');
    const attributes = {
      src: source,
      alt: '',
      loading: 'lazy',
      sizes: '2px',
      srcset: `${candidate} 2w`,
      crossorigin: 'anonymous',
      referrerpolicy: 'no-referrer',
      style,
    };
    for (const [name, value] of Object.entries(attributes)) image.setAttribute(name, value);
    return image;
  };
  const image = imageOf(src, candidate);
  // A lazy image below the view loads no picture.
  html('').append(image, imageOf(farSrc, farCandidate, 'position: absolute; top: 100000px'));
  await event(image, 'load');
  for (let frame = 0; frame < 10; frame += 1) await nextFrame();
  expect(image.currentSrc).toBe(candidate);
  expect(requested(src, candidate, farSrc, farCandidate).sort()).toEqual(
    (server.browser === 'webkit' ? [src, candidate, farSrc] : [candidate]).sort(),
  );
});

test('Firefox sends the load event of a source that a new source replaced in the same task', async () => {
  const next = await pictureThatMustLoad();
  const attrs = reactive<Record<string, unknown>>({ alt: '', src: await pictureThatBrowserHas() });
  const loads: boolean[] = [];
  attrs.onLoad = (loaded: Event) => loads.push((loaded.target as HTMLImageElement).complete);
  const image = mount(MeasureImage, { attrs }).root.querySelector('img')!;
  const loaded = new Promise<void>((resolve) => {
    image.addEventListener('load', () => image.complete && resolve());
  });
  attrs.src = next;
  await nextTick();
  await loaded;
  expect(loads).toEqual(server.browser === 'firefox' ? [false, true] : [true]);
});

test('an SVG picture with a viewBox and no width has a natural width, after its load and from the document', async () => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 2"><rect width="4" height="2"/></svg>';
  const url = `data:image/svg+xml,${encodeURIComponent(svg)}#${Math.random()}`;
  const image = Object.assign(new Image(), { src: url });
  await event(image, 'load');
  expect(read(image)).toEqual({ complete: true, loaded: true });
  expect(read(Object.assign(new Image(), { src: url }))).toEqual({ complete: true, loaded: true });
});

test('a lazy img with the hidden attribute requests no picture, and one with visibility: hidden does', async () => {
  const [hidden, invisible] = ['hidden', 'invisible'].map(newServerUrl) as [string, string];
  performance.clearResourceTimings();
  const [, shown] = html(
    `<img alt="" loading="lazy" hidden src="${hidden}"><img alt="" loading="lazy" style="visibility: hidden" src="${invisible}">`,
  ).querySelectorAll('img');
  await event(shown!, 'load');
  for (let frame = 0; frame < 10; frame += 1) await nextFrame();
  expect(requested(hidden, invisible)).toEqual([invisible]);
});

test('in Firefox, a lazy img with a srcset that the document has is not complete below the view', async () => {
  const url = await pictureThatBrowserHas();
  const image = html(
    `<img alt="" loading="lazy" style="position: absolute; top: 100000px" sizes="2px" srcset="${url} 2w">`,
  ).querySelector('img')!;
  for (let frame = 0; frame < 10; frame += 1) await nextFrame();
  const complete = server.browser !== 'firefox';
  expect(read(image)).toEqual({ complete, loaded: complete });
});
