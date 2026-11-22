// Measurements with native elements and plain Vue, with no code of the library. Each one states
// what the browser or Vue does, so that a calendar part has code only where they do not do it.
// Where the browsers differ, the measurement states each one.
import { afterEach, describe, expect, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick } from 'vue';
import MeasureCapturedButton from '../fixtures/MeasureCapturedButton.vue';
import MeasureIntlTexts from '../fixtures/MeasureIntlTexts.vue';
import MeasureLeavingButton from '../fixtures/MeasureLeavingButton.vue';
import MeasureRefusedSelect from '../fixtures/MeasureRefusedSelect.vue';
import { finishAnimations } from '../animation';
import { mount, renderOnServer } from '../render';

let root: HTMLElement | undefined;

afterEach(async () => {
  root?.remove();
  root = undefined;
  await userEvent.pointer({ coords: { x: 0, y: 0 }, keys: '[/MouseLeft]' });
});

function centerOf(element: Element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

describe('a click on a button with tabindex="-1" in a table', () => {
  // Safari gives a button no focus at a click by design (MDN, <button>, "Clicking and focus"). The
  // WebKit of Playwright is not Safari, on macOS and on Linux.
  test('gives the button the focus in the three browsers, on macOS and on Linux', async () => {
    root = document.body.appendChild(document.createElement('div'));
    root.innerHTML = '<table><tr><td><button tabindex="-1">18</button></td></tr></table>';
    const button = root.querySelector('button')!;
    await userEvent.click(button);
    expect(document.activeElement).toBe(button);
  });
});

// The leave lasts until the case ends it, so the click and the Tab come during the leave.
describe('a button that leaves in a <Transition>', () => {
  async function leave(inert: boolean) {
    const { root: container, exposed } = mount(MeasureLeavingButton);
    const leaving = container.querySelector<HTMLElement>('#leaving')!;
    exposed.hide();
    await nextTick();
    expect(leaving).toHaveClass('measure-leave-leave-active');
    leaving.inert = inert;
    await userEvent.pointer({ coords: centerOf(leaving), keys: '[MouseLeft]' });
    container.querySelector<HTMLElement>('#before')!.focus();
    await userEvent.keyboard('{Tab}');
    const result = { clicks: exposed.clicks as number, focused: document.activeElement?.id };
    await finishAnimations(leaving);
    return result;
  }

  test('takes a click and the focus of Tab while it leaves', async () => {
    expect(await leave(false)).toEqual({ clicks: 1, focused: 'leaving' });
  });

  test('takes no click and no focus with inert', async () => {
    expect(await leave(true)).toEqual({ clicks: 0, focused: 'after' });
  });
});

describe('a select whose options bind selected to a value that a change keeps', () => {
  test('shows the option of the user, because Vue writes an option only when its binding changes', async () => {
    const { root: container, exposed } = mount(MeasureRefusedSelect);
    const select = container.querySelector('select')!;
    await userEvent.selectOptions(select, 'b');
    await nextTick();
    expect(exposed.changes).toBe(1);
    expect(exposed.value).toBe('a');
    expect(select.value).toBe('b');
  });
});

describe('a drag of the real pointer from button A, which takes the capture, to button B', () => {
  test('ends with a click on A in the three browsers', async () => {
    const log: string[] = [];
    const { root: container } = mount(MeasureCapturedButton, {
      log: { add: (entry: string) => log.push(entry) },
    });
    const a = centerOf(container.querySelector('#A')!);
    const b = centerOf(container.querySelector('#B')!);
    await userEvent.pointer([
      { coords: a, keys: '[MouseLeft>]' },
      { coords: b },
      { keys: '[/MouseLeft]' },
    ]);
    expect(log).toEqual(['pointerup A', 'lostpointercapture A', 'click A 1']);
  });

  test('gives the release outside the box to no element of the box when Vue removes A during the press', async () => {
    const log: string[] = [];
    const { root: container, exposed } = mount(MeasureCapturedButton, {
      log: { add: (entry: string) => log.push(entry) },
    });
    const box = container.querySelector('#box')!;
    const a = centerOf(container.querySelector('#A')!);
    await userEvent.pointer({ coords: a, keys: '[MouseLeft>]' });
    exposed.removeA();
    await nextTick();
    const outside = { x: a.x, y: box.getBoundingClientRect().bottom + 20 };
    await userEvent.pointer([{ coords: outside }, { keys: '[/MouseLeft]' }]);
    expect(log.filter((entry) => / (A|B|box)( |$)/.test(entry))).toEqual([]);
  });
});

describe('the data of Intl on the server and in the browser', () => {
  const locales = [
    'en-US',
    'fr',
    'ar-EG',
    'he',
    'ja',
    'fa-IR',
    'th-TH',
    'ar-SA',
    'ar-SA-u-ca-islamic',
  ];

  async function read() {
    const onServer = await renderOnServer('MeasureIntlTexts', { locales });
    const { root: inBrowser } = mount(MeasureIntlTexts, { locales });
    const items = (element: Element) => [...element.querySelectorAll('li')];
    const texts = (element: Element) =>
      items(element).map((item) =>
        [...item.querySelectorAll('span')].map((span) => span.textContent),
      );
    const calendars = (element: Element) =>
      items(element).map((item) => item.getAttribute('data-calendar'));
    return {
      texts: [texts(onServer), texts(inBrowser)] as const,
      calendars: [calendars(onServer), calendars(inBrowser)] as const,
    };
  }

  // The server writes a range with thin spaces around the dash, and Chromium with spaces. WebKit
  // also has other names of the days and other forms of a full date in `ar-EG` and `ja`.
  test('gives other texts of a range of years in each browser, and other texts of a day in WebKit', async () => {
    const [onServer, inBrowser] = (await read()).texts;
    const ranges = (texts: readonly (string | null)[][]) => texts.map((item) => item[0]);
    const days = (texts: readonly (string | null)[][]) => texts.map((item) => item.slice(1));
    expect(ranges(inBrowser)).not.toEqual(ranges(onServer));
    expect(days(inBrowser).join() === days(onServer).join()).toBe(server.browser !== 'webkit');
  });

  // Firefox and WebKit resolve `ar-SA-u-ca-islamic` to `islamic-tbla`, which their `Temporal` has,
  // and Node.js resolves it to `islamic`, which `Temporal` refuses.
  test('gives the same calendar of each locale in Chromium, and others in Firefox and WebKit', async () => {
    const [onServer, inBrowser] = (await read()).calendars;
    expect(JSON.stringify(inBrowser) === JSON.stringify(onServer)).toBe(
      server.browser === 'chromium',
    );
  });
});
