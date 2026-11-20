// Measurements with native elements and plain Vue, with no code of the library. Each one states
// what the browser or Vue does, so that a picker part has code only where they do not do it. Where
// the browsers differ, the measurement states each one.
import { afterEach, describe, expect, test } from 'vitest';
import { server } from 'vitest/browser';
import { nextTick } from 'vue';
import MeasureDisplayNames from '../fixtures/MeasureDisplayNames.vue';
import MeasureOwnedProps from '../fixtures/MeasureOwnedProps.vue';
import { mount, renderOnServer } from '../render';

let root: HTMLElement | undefined;

afterEach(() => {
  root?.remove();
  root = undefined;
});

describe('focus({ preventScroll: true }) on a button below the view of an element that scrolls', () => {
  function scroller(nested: boolean) {
    root = document.body.appendChild(document.createElement('div'));
    const list = '<div class="list" style="height: 60px; overflow: auto"><div style="height: 200px"></div><button>Late</button></div>';
    root.innerHTML = nested
      ? `<div class="outer" style="height: 80px; overflow: auto"><div style="height: 200px"></div>${list}</div>`
      : list;
    const button = root.querySelector('button')!;
    button.focus({ preventScroll: true });
    return [...root.querySelectorAll<HTMLElement>('.list, .outer')].map((element) => element.scrollTop);
  }

  test('scrolls no element, alone and in a second element that scrolls, in the three browsers', () => {
    expect(scroller(false)).toEqual([0]);
    expect(scroller(true)).toEqual([0, 0]);
  });
});

describe('a wrapper that binds mergeProps(attrs, { minDays: undefined, multiple: undefined }) to its inner part', () => {
  test('gives the inner part undefined for an attribute in kebab case and in camel case, in each app setup', async () => {
    ({ root } = mount(MeasureOwnedProps));
    await nextTick();
    const props = (id: string) => {
      const inner = root!.querySelector(`#${id}`)!;
      return [inner.getAttribute('data-min-days'), inner.getAttribute('data-multiple')];
    };
    expect(props('kebab')).toEqual(['undefined', 'undefined']);
    expect(props('camel')).toEqual(['undefined', 'undefined']);
  });
});

describe('the names of the units in Intl.DisplayNames on the server and in the browser', () => {
  // The locales of the measurement of the date and time fields.
  const locales = ['en-US', 'en-CA', 'en-IN', 'de-DE', 'fr-FR', 'es-US', 'pt-PT', 'nl-NL', 'nb-NO'];
  locales.push('bg-BG', 'el-GR', 'he-IL', 'ar-EG', 'fa-IR', 'hi-IN', 'ja-JP', 'ko-KR', 'zh-CN');
  locales.push('zh-TW', 'eu-ES', 'ur-PK');

  // Chromium lacks the data of `eu-ES`, and WebKit has another name of the day period in `bg-BG`.
  test('gives the same names only in Firefox', async () => {
    const onServer = await renderOnServer('MeasureDisplayNames', { locales });
    ({ root } = mount(MeasureDisplayNames, { locales }));
    const names = (element: Element) =>
      [...element.querySelectorAll('li')].map((item) => item.textContent);
    expect(names(root).join() === names(onServer).join()).toBe(server.browser === 'firefox');
  });
});
