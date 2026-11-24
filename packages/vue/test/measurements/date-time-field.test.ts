// Measurements with native elements and plain Vue, with no code of the library, for DateField and
// TimeField. Each one states what the browser or Vue does, so that a part has code only where they
// do not do it.
import { afterEach, describe, expect, inject, test } from 'vitest';
import { cdp, server, userEvent } from 'vitest/browser';
import MeasureHydratedList, { type MeasuredItem } from '../fixtures/MeasureHydratedList.vue';
import { hydrate, renderOnServer, settle } from '../render';
import { takeReportedMessages } from '../reportedMessages';
import type { hydrateMeasureList } from './hydrateMeasureList';

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

describe('a native date input', () => {
  test('Backspace empties a unit, so the input has no value', async () => {
    // On a repeat, WebKit goes back in the history at Backspace in a date input from the HTML parser
    // with no layout yet. That closes the connection of the browser.
    const input = html('').appendChild(document.createElement('input'));
    input.type = 'date';
    input.value = '2026-11-14';
    expect(input.value).toBe('2026-11-14');
    input.focus();
    await userEvent.keyboard('{Backspace}');
    expect(input.value).toBe('');
  });

  // The visible control of a field is no native date input: the browsers do not agree on typed
  // digits, and no attribute gives a locale, an hour cycle or a calendar.
  test('typed digits give a date in Chromium and Firefox, and no date in WebKit; `lang` changes nothing', async () => {
    const input = html('<input type="date" lang="de-DE">').querySelector('input')!;
    input.focus();
    await userEvent.keyboard('11142026');
    expect(input.value).toBe(server.browser === 'webkit' ? '' : '2026-11-14');
  });

  test('an input that is not in the document gives the message of each failure', () => {
    const input = document.createElement('input');
    input.type = 'date';
    input.min = '2026-11-20';
    input.value = '2026-11-14';
    expect(input.validity.rangeUnderflow).toBe(true);
    expect(input.validationMessage).not.toBe('');
  });

  // Vue writes the `value` attribute of an input at each value, so a time input with `step` and
  // no `min` takes its own value as the step base, and has no step mismatch.
  test('the `value` attribute is the step base of an input with no `min`', () => {
    const withAttribute = document.createElement('input');
    withAttribute.type = 'time';
    withAttribute.setAttribute('value', '15:04');
    withAttribute.step = '300';
    const withMin = document.createElement('input');
    withMin.type = 'time';
    withMin.setAttribute('value', '15:04');
    withMin.min = '00:00';
    withMin.step = '300';
    expect([withAttribute.validity.stepMismatch, withMin.validity.stepMismatch]).toEqual([
      false,
      true,
    ]);
  });

  test('a blocked submit gives the focus to an invalid input of 1 px that is hidden from assistive technology', () => {
    const form = html(
      '<form><input required aria-hidden="true" tabindex="-1" style="position:absolute;width:1px;height:1px"><button>Go</button></form>',
    ).querySelector('form')!;
    form.requestSubmit();
    expect(document.activeElement).toBe(form.querySelector('input'));
  });

  // A segment is a text input, so Enter submits the form natively, as in a date input.
  test('Enter in a text input submits its form through the submit button', async () => {
    const form = html('<form><input><button>Go</button></form>').querySelector('form')!;
    const submits: string[] = [];
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits.push((event.submitter as HTMLElement).textContent!);
    });
    form.querySelector('input')!.focus();
    await userEvent.keyboard('{Enter}');
    expect(submits).toEqual(['Go']);
  });
});

describe('a text input', () => {
  test('`focus()` selects the text in WebKit, and puts the caret at the start in Chromium and Firefox', () => {
    const input = html('<input value="2026">').querySelector('input')!;
    input.focus();
    expect([input.selectionStart, input.selectionEnd]).toEqual(
      server.browser === 'webkit' ? [0, 4] : [0, 0],
    );
  });

  test('WebKit sends no `beforeinput` for Backspace in an empty input', async () => {
    const input = html('<input>').querySelector('input')!;
    const types: string[] = [];
    input.addEventListener('beforeinput', (event) => types.push(event.inputType));
    input.focus();
    await userEvent.keyboard('{Backspace}');
    expect(types).toEqual(server.browser === 'webkit' ? [] : ['deleteContentBackward']);
  });

  // A real composition of Chromium, through the DevTools Protocol. Playwright gives the other
  // engines no input method.
  test.runIf(server.browser === 'chromium')(
    'a composition gives its text through `input` events and one `compositionend`',
    async () => {
      const input = html('<input>').querySelector('input')!;
      const log: string[] = [];
      input.addEventListener('input', (event) =>
        log.push(`input ${(event as InputEvent).inputType} ${(event as InputEvent).isComposing}`),
      );
      input.addEventListener('compositionend', (event) => log.push(`end ${event.data}`));
      input.focus();
      for (const text of ['1', '12']) {
        await cdp().send('Input.imeSetComposition', {
          text,
          selectionStart: text.length,
          selectionEnd: text.length,
        });
      }
      await cdp().send('Input.insertText', { text: '12' });
      expect(log).toEqual([
        'input insertCompositionText true',
        'input insertCompositionText true',
        'input insertCompositionText true',
        'end 12',
      ]);
    },
  );

  // So a root finds the labels of its first segment by `for`, and not by `labels`.
  test('`labels` keeps its old list after a change of the `id` of the input in WebKit', () => {
    const container = html('<label for="a">A</label><label for="b">B</label><input id="a">');
    const input = container.querySelector('input')!;
    expect([...input.labels!].map((label) => label.textContent)).toEqual(['A']);
    input.id = 'b';
    expect([...input.labels!].map((label) => label.textContent)).toEqual(
      server.browser === 'webkit' ? ['A'] : ['B'],
    );
    const labelOfB = container.querySelectorAll('label')[1]!;
    expect(labelOfB.control).toBe(input);
  });
});

describe('the names of Intl', () => {
  // The placeholder of a date unit is its narrow name.
  test('`Intl.DisplayNames` gives a narrow name of each date unit', () => {
    const names = new Intl.DisplayNames('en-US', { type: 'dateTimeField', style: 'narrow' });
    expect(['year', 'month', 'day'].map((unit) => names.of(unit))).toEqual(['yr', 'mo', 'day']);
  });
});

const input = (label: string, max: string, value: string, placeholder = '--'): MeasuredItem => ({
  input: true,
  attrs: { 'aria-label': label, 'aria-valuemax': max, placeholder },
  value,
});
const text = (value: string, hidden = true): MeasuredItem => ({
  input: false,
  text: value,
  hidden,
});

// Each case: the items of the server, then the items of the browser.
const CASES: Record<string, [MeasuredItem[], MeasuredItem[]]> = {
  'a literal text': [
    [input('month', '12', '11'), text('/'), input('day', '31', '14')],
    [input('month', '12', '11'), text('.'), input('day', '31', '14')],
  ],
  'an attribute': [
    [input('month', '12', '11', 'mo.'), text('/'), input('day', '31', '14')],
    [input('month', '12', '11', 'mo'), text('/'), input('day', '31', '14')],
  ],
  'another order': [
    [input('day', '31', '14'), text('/'), input('month', '12', '11')],
    [input('month', '12', '11'), text('/'), input('day', '31', '14')],
  ],
  'another tag at a place': [
    [input('hour', '23', '15'), text(':'), input('minute', '59', '04'), text(' UTC', false)],
    [text('UTC ', false), input('hour', '23', '15'), text(':'), input('minute', '59', '04')],
  ],
  'another count': [
    [input('hour', '23', '15'), text(':'), input('minute', '59', '04')],
    [
      input('hour', '12', '3'),
      text(':'),
      input('minute', '59', '04'),
      text(' '),
      input('AM/PM', '1', 'PM'),
    ],
  ],
};

/** The DOM of the list, in the form of the items. */
function shownItems(container: Element) {
  return [...container.querySelectorAll('.Box > *')].map((element) =>
    element.localName === 'input'
      ? `input ${element.getAttribute('aria-label')} ${element.getAttribute('aria-valuemax')} ${element.getAttribute('placeholder')} ${(element as HTMLInputElement).value}`
      : `span ${JSON.stringify(element.textContent)} ${element.getAttribute('aria-hidden')}`,
  );
}

async function hydrateCase(name: string, props: { allow: boolean; write: boolean }) {
  const [serverItems, clientItems] = CASES[name]!;
  const container = await renderOnServer('MeasureHydratedList', { items: serverItems, ...props });
  hydrate(MeasureHydratedList, { items: clientItems, ...props }, container);
  await settle();
  return { shown: shownItems(container), messages: takeReportedMessages() };
}

/** The DOM that a client render of the items gives. */
function rightItems(items: MeasuredItem[]) {
  return items.map((item) =>
    item.input
      ? `input ${item.attrs!['aria-label']} ${item.attrs!['aria-valuemax']} ${item.attrs!.placeholder} ${item.value}`
      : `span ${JSON.stringify(item.text)} ${item.hidden ? 'true' : null}`,
  );
}

// The fixture compiles as a Vapor component in these setups of `vitest.vue-3.6.config.ts`.
const isVaporFixture = ['vapor', 'vapor-interop'].includes(inject('app'));

describe('Vue hydrates a list of inputs and spans that differs from the server HTML', () => {
  // `data-allow-mismatch` on the list covers the text of each span, and on each input its
  // attributes. Vue keeps each element of the same tag, and an element of another tag goes.
  test.each(['a literal text', 'an attribute', 'another order', 'another tag at a place'])(
    '%s: with `data-allow-mismatch` and a write of the attributes after the mount, the DOM of the browser and no message',
    async (name) => {
      const { shown, messages } = await hydrateCase(name, { allow: true, write: true });
      expect(shown).toEqual(rightItems(CASES[name]![1]));
      expect(messages).toEqual([]);
    },
  );

  // So a segment writes its attributes again after the mount.
  test.each([
    ['an attribute', 'input month 12 mo. 11'],
    ['another order', 'input day 31 -- 11'],
  ])(
    '%s: without a write after the mount, an input keeps the attributes of the server',
    async (name, first) => {
      const { shown } = await hydrateCase(name, { allow: true, write: false });
      expect(shown[0]).toBe(first);
    },
  );

  // Vue logs this message one time for each copy of its module (`hasLoggedMismatchError`), so each
  // run hydrates in a frame of its own.
  test('another count: the DOM of the browser, and one message of a virtual DOM component also under `data-allow-mismatch`', async () => {
    const [serverItems, clientItems] = CASES['another count']!;
    const props = { allow: true, write: true };
    const serverRoot = await renderOnServer('MeasureHydratedList', {
      items: serverItems,
      ...props,
    });
    const frame = document.createElement('iframe');
    const loaded = new Promise<void>((resolve) =>
      frame.addEventListener('load', () => resolve(), { once: true }),
    );
    frame.srcdoc = '<!doctype html><html><body><div></div></body></html>';
    html('').appendChild(frame);
    await loaded;
    const frameWindow = frame.contentWindow as Window & {
      onFrameReady?: (fn: typeof hydrateMeasureList) => void;
      onFrameError?: (error: unknown) => void;
    };
    // Vite gives the flags to this page only. The Vue of the frame writes to the console of this
    // page, so its messages reach `takeReportedMessages()`.
    Object.assign(frameWindow, {
      console,
      __VUE_OPTIONS_API__: true,
      __VUE_PROD_DEVTOOLS__: false,
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
    });
    const container = frame.contentDocument!.body.firstElementChild!;
    container.innerHTML = serverRoot.innerHTML;
    const moduleUrl = new URL('./hydrateMeasureList.ts', import.meta.url).href;
    const hydrateInFrame = await new Promise<typeof hydrateMeasureList>((resolve, reject) => {
      frameWindow.onFrameReady = resolve;
      frameWindow.onFrameError = reject;
      const script = frame.contentDocument!.createElement('script');
      script.type = 'module';
      script.textContent = `import(${JSON.stringify(moduleUrl)}).then((mod) => window.onFrameReady(mod.hydrateMeasureList), (err) => window.onFrameError(err));`;
      frame.contentDocument!.head.appendChild(script);
    });
    const unmount = await hydrateInFrame(
      inject('app'),
      { items: clientItems, ...props },
      container,
    );
    try {
      expect(shownItems(container)).toEqual(rightItems(clientItems));
      expect(takeReportedMessages()).toEqual(
        isVaporFixture ? [] : ['console.error: Hydration completed but contains mismatches.'],
      );
    } finally {
      unmount();
    }
  });

  test('without `data-allow-mismatch`, Vue warns for a text', async () => {
    const { messages } = await hydrateCase('a literal text', { allow: false, write: true });
    expect(messages.length).toBeGreaterThan(0);
  });
});
