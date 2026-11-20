// Measurements for Menu, ContextMenu, Menubar and the list, with native elements and no code of the
// library. Each one states what the browser does, so that the parts have code only where it does
// not do the right thing. Where the browsers differ, the measurement states each one.
import { afterEach, describe, expect, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { touchDrag } from '../pointer';

let root: HTMLElement | undefined;

afterEach(() => {
  root?.remove();
  root = undefined;
});

function html(markup: string) {
  root = document.body.appendChild(document.createElement('div'));
  root.innerHTML = markup;
  return root;
}

function element<T extends HTMLElement = HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}

const nameOf = (target: EventTarget | null) =>
  (target as Element | null)?.id || (target as Element | null)?.localName || 'null';

function record(
  types: string[],
  format = (event: Event) => `${event.type} ${nameOf(event.target)}`,
) {
  const log: string[] = [];
  const listeners = types.map((type) => {
    const listener = (event: Event) => log.push(format(event));
    document.addEventListener(type, listener, true);
    return () => document.removeEventListener(type, listener, true);
  });
  return {
    log,
    stop: () => {
      for (const stop of listeners) stop();
    },
  };
}

function centerOf(target: Element) {
  const rect = target.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('a press of the right button (MM1, MN3)', () => {
  test('sends `contextmenu` at the press, with `buttons` 2, on macOS and Linux', async () => {
    html('<div id="area" style="width: 300px; height: 200px">Area</div>');
    const prevent = (event: Event) => event.preventDefault();
    document.addEventListener('contextmenu', prevent);
    const { log, stop } = record(
      ['pointerdown', 'mousedown', 'contextmenu', 'pointerup', 'mouseup'],
      (event) =>
        event.type === 'contextmenu' ? `contextmenu ${(event as MouseEvent).buttons}` : event.type,
    );
    try {
      await userEvent.pointer([{ coords: centerOf(element('area')) }, '[MouseRight>]']);
      expect(log).toEqual(['pointerdown', 'mousedown', 'contextmenu 2']);
      await userEvent.pointer('[/MouseRight]');
      expect(log.slice(3)).toEqual(['pointerup', 'mouseup']);
    } finally {
      stop();
      document.removeEventListener('contextmenu', prevent);
    }
  });
});

describe('a fixed element that a `pointerdown` listener removes in a microtask (MM2)', () => {
  test('gives the `contextmenu` of that right press to the element below it', async () => {
    html(`<div id="trigger" style="position: absolute; left: 0; top: 0; width: 300px; height: 200px"></div>
      <div id="block" style="position: fixed; inset: 0"></div>`);
    const remove = () => queueMicrotask(() => element('block')?.remove());
    document.addEventListener('pointerdown', remove, true);
    const prevent = (event: Event) => event.preventDefault();
    document.addEventListener('contextmenu', prevent);
    const { log, stop } = record(['contextmenu']);
    try {
      await userEvent.pointer([{ coords: { x: 100, y: 80 } }, '[MouseRight>]', '[/MouseRight]']);
      expect(log).toEqual(['contextmenu trigger']);
    } finally {
      stop();
      document.removeEventListener('pointerdown', remove, true);
      document.removeEventListener('contextmenu', prevent);
    }
  });
});

const ITEMS = Array.from(
  { length: 30 },
  (_, i) => `<div id="i${i}" style="height: 30px">${i}</div>`,
).join('');

describe('the pointer and content that moves (MM3, MM4, MM11)', () => {
  test('a move in one step sends `pointerover` and then `pointermove` at one place', async () => {
    html(
      `<div id="list" style="position: absolute; left: 0; top: 100px; width: 200px; height: 150px; overflow: auto">${ITEMS}</div>`,
    );
    await userEvent.pointer({ coords: { x: 300, y: 40 } });
    const { log, stop } = record(['pointerover', 'pointermove'], (event) => {
      const pointer = event as PointerEvent;
      return `${event.type} ${nameOf(event.target)} ${pointer.clientX},${pointer.clientY}`;
    });
    try {
      await userEvent.pointer({ coords: { x: 100, y: 115 } });
      expect(log).toEqual(['pointerover i0 100,115', 'pointermove i0 100,115']);
    } finally {
      stop();
    }
  });

  test('a list that scrolls under a pointer that rests gives `pointerover` to the new item; WebKit also gives `pointermove` at the last place', async () => {
    html(
      `<div id="list" style="position: absolute; left: 0; top: 0; width: 200px; height: 150px; overflow: auto">${ITEMS}</div>`,
    );
    await userEvent.pointer({ coords: { x: 100, y: 75 } });
    const { log, stop } = record(['pointerover', 'pointermove'], (event) => {
      const pointer = event as PointerEvent;
      return `${event.type} ${nameOf(event.target)} ${pointer.clientX},${pointer.clientY}`;
    });
    try {
      element('list').scrollTop = 90;
      await wait(300);
      const moves = log.filter((entry) => entry.startsWith('pointermove'));
      expect(log[0]).toBe('pointerover i5 100,75');
      expect(moves).toEqual(server.browser === 'webkit' ? ['pointermove i5 100,75'] : []);
    } finally {
      stop();
    }
  });

  test('an element that appears under a pointer that rests gets `pointerover` and no `pointermove`', async () => {
    html('<div style="height: 300px"></div>');
    await userEvent.pointer({ coords: { x: 100, y: 100 } });
    const { log, stop } = record(['pointerover', 'pointermove']);
    try {
      const item = root!.appendChild(document.createElement('div'));
      item.id = 'item';
      item.style.cssText = 'position: fixed; left: 50px; top: 50px; width: 200px; height: 100px';
      await wait(300);
      expect(log).toEqual(['pointerover item']);
    } finally {
      stop();
    }
  });
});

describe('a press on an item with no tab stop, while an input has the focus (MM5)', () => {
  test.each([
    { prevent: 'none', focus: 'popup' },
    { prevent: 'mousedown', focus: 'input' },
  ])(
    'with `preventDefault()` at $prevent gives the focus to the $focus and a click to the item',
    async ({ prevent, focus }) => {
      html(`<div id="popup" tabindex="-1"><input id="input" aria-label="Input" />
      <div id="item" role="menuitem" style="height: 40px">Item</div></div>`);
      if (prevent !== 'none')
        element('item').addEventListener(prevent, (event) => event.preventDefault());
      let clicks = 0;
      element('item').addEventListener('click', () => (clicks += 1));
      element('input').focus();
      await userEvent.click(element('item'));
      expect(document.activeElement?.id).toBe(focus);
      expect(clicks).toBe(1);
    },
  );
});

describe('Enter and Space (MM6)', () => {
  test('give a focused `<div role="menuitem">` no click; Enter gives a link a click with a `detail` that differs; Space gives it none', async () => {
    html(
      `<div id="div" role="menuitem" tabindex="0">Div</div><a id="link" href="#measure">Link</a>`,
    );
    const clicks: string[] = [];
    for (const id of ['div', 'link']) {
      element(id).addEventListener('click', (event) => {
        clicks.push(`${id} ${event.detail}`);
        event.preventDefault();
      });
    }
    element('div').focus();
    await userEvent.keyboard('{Enter} ');
    element('link').focus();
    await userEvent.keyboard(' ');
    expect(clicks).toEqual([]);
    await userEvent.keyboard('{Enter}');
    expect(clicks).toEqual([`link ${server.browser === 'firefox' ? 1 : 0}`]);
  });

  test('a `keydown` listener of Enter that gives the focus to a button lets the key press that button', async () => {
    html(`<div id="item" tabindex="0">Item</div><button id="button">Button</button>`);
    let clicks = 0;
    element('button').addEventListener('click', () => (clicks += 1));
    element('item').addEventListener('keydown', () => element('button').focus());
    element('item').focus();
    await userEvent.keyboard('{Enter}');
    expect(clicks).toBe(1);
  });
});

describe('a press on a button, a drag, and the release on an item (MM7)', () => {
  test('gives the item `pointerup` and the common ancestor `click`; the button has the focus after the press but in WebKit', async () => {
    html(`<button id="trigger" style="position: absolute; left: 0; top: 0; width: 100px; height: 30px">Trigger</button>
      <div id="popup" hidden style="position: absolute; left: 0; top: 40px; width: 200px">
        <div id="item" role="menuitem" style="height: 30px">Item</div></div>`);
    element('trigger').addEventListener('pointerdown', () => (element('popup').hidden = false));
    const { log, stop } = record(['pointerup', 'click']);
    try {
      await userEvent.pointer([{ coords: { x: 50, y: 15 } }, '[MouseLeft>]']);
      const focus = document.activeElement?.id || document.activeElement?.localName;
      expect(focus).toBe(server.browser === 'webkit' ? 'body' : 'trigger');
      await userEvent.pointer([{ coords: { x: 50, y: 55 } }, '[/MouseLeft]']);
      expect(log).toEqual(['pointerup item', 'click div']);
    } finally {
      stop();
    }
  });
});

describe('the scroll of a list (MM8)', () => {
  test('`focus()` puts an item below the fold in the middle; `scrollIntoView` with `nearest` moves it one row', async () => {
    const items = Array.from(
      { length: 20 },
      (_, i) => `<div id="i${i}" tabindex="-1" style="height: 30px">${i}</div>`,
    ).join('');
    html(
      `<div id="list" style="position: absolute; left: 0; top: 0; width: 200px; height: 150px; overflow: auto">${items}</div>`,
    );
    element('i5').focus();
    await nextFrame();
    expect(element('list').scrollTop).toBe(90);
    element('list').scrollTop = 0;
    element('i5').focus({ preventScroll: true });
    element('i5').scrollIntoView({ block: 'nearest', inline: 'nearest' });
    await nextFrame();
    expect(element('list').scrollTop).toBe(30);
  });
});

describe('a focused element that leaves (MM9)', () => {
  test('with `hidden` sends `focusout` with no related target, and the focus goes to <body>', async () => {
    html(
      `<div id="popup" tabindex="-1"><div id="group"><div id="item" tabindex="0">Item</div></div></div>`,
    );
    for (const target of ['item', 'group']) {
      element('item').hidden = false;
      element('group').hidden = false;
      element('item').focus();
      const { log, stop } = record(
        ['focusout'],
        (event) => `focusout ${nameOf((event as FocusEvent).relatedTarget)}`,
      );
      element(target).hidden = true;
      await nextFrame();
      await nextFrame();
      stop();
      expect(log).toEqual(['focusout null']);
      expect(document.activeElement).toBe(document.body);
      expect(element('item').checkVisibility()).toBe(false);
    }
  });

  test('from the DOM sends `focusout` only in Chromium', async () => {
    html(`<div id="popup" tabindex="-1"><div id="item" tabindex="0">Item</div></div>`);
    element('item').focus();
    const { log, stop } = record(['focusout']);
    element('item').remove();
    await nextFrame();
    stop();
    expect(log).toEqual(server.browser === 'chromium' ? ['focusout item'] : []);
    expect(document.activeElement).toBe(document.body);
  });
});

describe('the text of hidden content (MM10)', () => {
  test('`textContent` has all the text; `innerText` leaves out a hidden child', () => {
    html(
      '<div id="a" hidden>Alpha <span>beta</span></div><div id="b">Gamma <span hidden>delta</span></div>',
    );
    expect(element('a').textContent).toBe('Alpha beta');
    expect(element('b').textContent).toBe('Gamma delta');
    expect(element('b').innerText).toBe('Gamma');
  });
});

describe('a fast sweep from a trigger across its siblings to outside (MN4)', () => {
  test('sends `pointerleave` to the trigger', async () => {
    html(`<div style="position: absolute; left: 0; top: 0; width: 200px">
      <div id="trigger" style="height: 30px">Trigger</div><div id="sibling" style="height: 30px">Sibling</div></div>`);
    await userEvent.pointer({ coords: centerOf(element('trigger')) });
    let left = false;
    element('trigger').addEventListener('pointerleave', () => (left = true));
    await userEvent.pointer({ coords: { x: 400, y: 300 } });
    expect(left).toBe(true);
  });
});

describe('a touch (MN1, MN2, MN5)', () => {
  test.skipIf(server.browser !== 'chromium')(
    'that rests 600 ms sends `pointerdown` and no `pointercancel`; its lift gives a click to the element under it',
    async () => {
      html(
        `<div id="area" style="width: 300px; height: 200px; -webkit-touch-callout: none">Area</div>`,
      );
      const { log, stop } = record(['pointerdown', 'pointercancel', 'pointerup', 'click']);
      try {
        await touchDrag(centerOf(element('area')), centerOf(element('area')), 0, 600);
        await wait(50);
        expect(log).toEqual(['pointerdown area', 'pointerup area', 'click area']);
      } finally {
        stop();
      }
    },
  );

  test.skipIf(server.browser !== 'chromium')(
    'that taps a button gives it the focus before the click',
    async () => {
      html('<button id="button">Button</button>');
      const { log, stop } = record(['focus', 'click']);
      try {
        await touchDrag(centerOf(element('button')), centerOf(element('button')), 0);
        await wait(50);
        expect(log).toEqual(['focus button', 'click button']);
      } finally {
        stop();
      }
    },
  );
});

describe('a pointer over an item of a parent menu under a submenu triangle (MN6)', () => {
  test('sends `pointermove` to the item at each move', async () => {
    html('<div id="item" style="width: 200px; height: 30px">Item</div>');
    let moves = 0;
    element('item').addEventListener('pointermove', () => (moves += 1));
    await userEvent.pointer([{ coords: { x: 10, y: 10 } }, { coords: { x: 60, y: 12 } }]);
    expect(moves).toBe(2);
  });
});
