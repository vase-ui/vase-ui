// Measurements with native elements and plain Vue, with no code of the library. Each one states
// what the browser or Vue does, so that a part has code only where they do not do it. Where the
// browsers differ, the measurement states each one.
import { afterEach, describe, expect, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextEvent } from '../animation';
import MeasureMergedClick from '../fixtures/MeasureMergedClick.vue';
import { mount, settle } from '../render';

let root: HTMLElement | undefined;

function html(markup: string) {
  root = document.body.appendChild(document.createElement('div'));
  root.innerHTML = markup;
  return root;
}

afterEach(() => {
  root?.remove();
  root = undefined;
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  window.scrollTo(0, 0);
});

/** Records each key event and each click of the element `#button`, with the detail and the modifier keys of the click. */
function recordKeys() {
  const button = root!.querySelector<HTMLElement>('#button')!;
  const log: string[] = [];
  for (const type of ['keydown', 'keyup']) {
    button.addEventListener(type, (event) => {
      const { key, repeat } = event as KeyboardEvent;
      log.push(`${type} ${key === ' ' ? 'Space' : key}${repeat ? ' repeat' : ''}`);
    });
  }
  button.addEventListener('click', (event) => {
    const modifiers = (['shiftKey', 'ctrlKey', 'altKey', 'metaKey'] as const).filter(
      (key) => (event as MouseEvent)[key],
    );
    log.push(['click', (event as MouseEvent).detail, ...modifiers].join(' '));
  });
  return { button, log };
}

describe('a press on a native disabled button', () => {
  test('gives the pointer events, and no mousedown, mouseup or click to the button or to an ancestor; a press on a child gives them to the child only', async () => {
    html(
      '<div id="ancestor"><button id="button" disabled style="padding: 20px">A <span id="child">child</span></button></div>',
    );
    const log: string[] = [];
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      const target = (id: string) => root!.querySelector(`#${id}`)!;
      target('ancestor').addEventListener(type, () => log.push(`${type} capture`), true);
      target('ancestor').addEventListener(type, () => log.push(`${type} ancestor`));
      target('button').addEventListener(type, () => log.push(`${type} button`));
      target('child').addEventListener(type, () => log.push(`${type} child`));
    }
    const pointer = (type: string, ...targets: string[]) =>
      ['capture', ...targets, 'button', 'ancestor'].map((target) => `${type} ${target}`);

    await userEvent.click(root!.querySelector('#button')!, {
      force: true,
      position: { x: 4, y: 4 },
    });
    expect(log).toEqual([...pointer('pointerdown'), ...pointer('pointerup')]);

    log.length = 0;
    await userEvent.click(root!.querySelector('#child')!, { force: true });
    expect(log).toEqual([
      ...pointer('pointerdown', 'child'),
      'mousedown child',
      ...pointer('pointerup', 'child'),
      'mouseup child',
      'click child',
    ]);
  });
});

describe('the keys of a native button', () => {
  test('Enter gives a click at keydown, and Space at keyup, with detail 0', async () => {
    html('<button id="button">B</button>');
    const { button, log } = recordKeys();
    button.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(log).toEqual([
      'keydown Enter',
      'click 0',
      'keyup Enter',
      'keydown Space',
      'keyup Space',
      'click 0',
    ]);
  });

  test('with a modifier key: Chromium and WebKit give the modifier keys to the click of Shift+Enter and of Space, and no click to Enter with Ctrl, Alt or Meta; Firefox gives no modifier keys, and no click to Alt+Space', async () => {
    html('<button id="button">B</button>');
    const { button, log } = recordKeys();
    const clicks: Record<string, string> = {};
    for (const key of ['Enter', ' ']) {
      for (const modifier of ['Shift', 'Control', 'Alt', 'Meta']) {
        button.focus();
        log.length = 0;
        await userEvent.keyboard(`{${modifier}>}{${key}}{/${modifier}}`);
        clicks[`${modifier}+${key === ' ' ? 'Space' : key}`] =
          log.find((entry) => entry.startsWith('click')) ?? 'none';
      }
    }
    expect(clicks).toEqual(
      server.browser === 'firefox'
        ? {
            'Shift+Enter': 'click 0',
            'Control+Enter': 'click 0',
            'Alt+Enter': 'click 0',
            'Meta+Enter': 'click 0',
            'Shift+Space': 'click 0',
            'Control+Space': 'click 0',
            'Alt+Space': 'none',
            'Meta+Space': 'click 0',
          }
        : {
            'Shift+Enter': 'click 0 shiftKey',
            'Control+Enter': 'none',
            'Alt+Enter': 'none',
            'Meta+Enter': 'none',
            'Shift+Space': 'click 0 shiftKey',
            'Control+Space': 'click 0 ctrlKey',
            'Alt+Space': 'click 0 altKey',
            'Meta+Space': 'click 0 metaKey',
          },
    );
  });

  test('gives no click after preventDefault() in keydown of Enter or of Space, or in keyup of Space', async () => {
    html('<button id="button">B</button>');
    const { button, log } = recordKeys();
    for (const [type, key] of [
      ['keydown', 'Enter'],
      ['keydown', ' '],
      ['keyup', ' '],
    ] as const) {
      const prevent = (event: Event) => {
        if ((event as KeyboardEvent).key === key) event.preventDefault();
      };
      button.addEventListener(type, prevent);
      button.focus();
      await userEvent.keyboard(key === ' ' ? ' ' : `{${key}}`);
      button.removeEventListener(type, prevent);
    }
    expect(log.filter((entry) => entry.startsWith('click'))).toEqual([]);
  });

  test('gives no click to a Space keyup with no Space keydown on the button', async () => {
    html('<input id="field"><button id="button">B</button>');
    const { button, log } = recordKeys();
    const field = root!.querySelector<HTMLInputElement>('#field')!;
    field.addEventListener('keydown', (event) => {
      if (event.key === ' ') {
        event.preventDefault();
        button.focus();
      }
    });
    field.focus();
    await userEvent.keyboard(' ');
    expect(document.activeElement).toBe(button);
    expect(log).toEqual(['keyup Space']);
  });

  test('Space gives the click at its own keyup when another key goes up first', async () => {
    html('<button id="button">B</button>');
    const { button, log } = recordKeys();
    button.focus();
    await userEvent.keyboard('{ >}{Shift}{/ }');
    expect(log).toEqual([
      'keydown Space',
      'keydown Shift',
      'keyup Shift',
      'keyup Space',
      'click 0',
    ]);
  });

  test('a held Enter gives a click for each keydown, and a held Space one click at keyup', async () => {
    html('<button id="button">B</button>');
    const { button, log } = recordKeys();
    button.focus();
    await userEvent.keyboard('{Enter>3/}');
    await userEvent.keyboard('{ >3/}');
    expect(log).toEqual([
      'keydown Enter',
      'click 0',
      'keydown Enter repeat',
      'click 0',
      'keydown Enter repeat',
      'click 0',
      'keyup Enter',
      'keydown Space',
      'keydown Space repeat',
      'keydown Space repeat',
      'keyup Space',
      'click 0',
    ]);
  });
});

describe('the keys of a link', () => {
  test('Enter gives one click and the move; Space gives no click and scrolls the page', async () => {
    html(
      '<a id="button" href="#measured-target">Go</a><div style="height: 3000px"></div><div id="measured-target">T</div>',
    );
    const { button, log } = recordKeys();
    button.focus();
    await userEvent.keyboard('{Enter}');
    await settle();
    // Firefox gives the detail 1 to the click of a key on a link.
    expect(log.slice(0, 2)).toEqual([
      'keydown Enter',
      `click ${server.browser === 'firefox' ? 1 : 0}`,
    ]);
    expect(location.hash).toBe('#measured-target');

    history.replaceState(null, '', location.pathname + location.search);
    await nextEvent(window, 'scroll', { action: () => window.scrollTo(0, 0) });
    log.length = 0;
    button.focus();
    await nextEvent(window, 'scroll', { action: () => userEvent.keyboard(' ') });
    expect(log).toEqual(['keydown Space', 'keyup Space']);
    expect(location.hash).toBe('');
    expect(window.scrollY).toBeGreaterThan(0);
  });
});

describe('a submit button with aria-disabled whose first click listener stops the click', () => {
  test('runs no later click listener and does not submit, from a press, Enter, Space and Enter in a text field; a keydown listener of an ancestor runs', async () => {
    html(
      '<div id="ancestor"><form><input id="field"><button id="button" type="submit" aria-disabled="true">Go</button></form></div>',
    );
    const button = root!.querySelector<HTMLButtonElement>('#button')!;
    const ancestor = root!.querySelector('#ancestor')!;
    const log: string[] = [];
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      log.push('stop');
    });
    button.addEventListener('click', () => log.push('later'));
    ancestor.addEventListener('click', () => log.push('ancestor'));
    ancestor.addEventListener('keydown', (event) => log.push((event as KeyboardEvent).key));
    root!.querySelector('form')!.addEventListener('submit', () => log.push('submit'));

    await userEvent.click(button, { force: true });
    button.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    root!.querySelector<HTMLInputElement>('#field')!.focus();
    await userEvent.keyboard('{Enter}');
    expect(log).toEqual(['stop', 'Enter', 'stop', ' ', 'stop', 'Enter', 'stop']);
  });
});

describe('the focus of a native button', () => {
  // The WebKit projects run with full keyboard access: the test setup turns it on in macOS, and
  // WebKit on Linux has no such setting. With that setting off, Tab passes a button in WebKit.
  test('Tab moves the focus to it; a click gives it the focus, but not in WebKit on macOS with no tabindex', async () => {
    const results: Record<string, string> = {};
    for (const tabindex of ['', ' tabindex="0"']) {
      html(`<input id="field"><button id="button"${tabindex}>B</button>`);
      const field = root!.querySelector<HTMLInputElement>('#field')!;
      field.focus();
      await userEvent.keyboard('{Tab}');
      results[`Tab${tabindex}`] = document.activeElement?.id || 'none';
      field.focus();
      await userEvent.click(root!.querySelector('#button')!);
      results[`click${tabindex}`] = document.activeElement?.id || 'none';
      root!.remove();
    }
    const isWebKitOnMac = server.browser === 'webkit' && server.platform === 'darwin';
    expect(results).toEqual({
      Tab: 'button',
      click: isWebKitOnMac ? 'none' : 'button',
      'Tab tabindex="0"': 'button',
      'click tabindex="0"': 'button',
    });
  });
});

describe('Vue', () => {
  test('runs no later listener of mergeProps after stopImmediatePropagation(), and no listener of an ancestor', () => {
    const log: string[] = [];
    const { root: mounted } = mount(MeasureMergedClick, {
      log: { add: (entry: string) => log.push(entry) },
    });
    mounted.querySelector('button')!.click();
    expect(log).toEqual(['first']);
  });
});
