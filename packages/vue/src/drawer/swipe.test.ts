import { afterEach, describe, expect, it } from 'vitest';
import {
  along,
  claimsTouch,
  closesAtRelease,
  ignoresTouch,
  opensAtRelease,
  pathTo,
  pressStartsSwipe,
  releaseStrength,
  resist,
  toward,
} from './swipe';

let container: HTMLElement | undefined;

afterEach(() => {
  container?.remove();
  container = undefined;
});

function html(markup: string) {
  container = document.body.appendChild(document.createElement('div'));
  container.innerHTML = markup;
  return container;
}

function byId(id: string) {
  return document.getElementById(id)!;
}

/** The event path of a press on the element, to the last element with that id. */
function pathOf(target: Element, last: Element) {
  let path: Element[] = [];
  target.addEventListener('pointerdown', (event) => (path = pathTo(event, last)), { once: true });
  target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  return path;
}

function pressOn(target: Element, popup: Element) {
  let starts = false;
  target.addEventListener(
    'pointerdown',
    (event) => (starts = pressStartsSwipe(event as PointerEvent, popup, 'y')),
    { once: true },
  );
  target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  return starts;
}

const SCROLLER = 'overflow-y: auto; height: 50px';

describe('directions', () => {
  it.each([
    { direction: 'down', x: 3, y: 5, value: 5 },
    { direction: 'up', x: 3, y: 5, value: -5 },
    { direction: 'right', x: 3, y: 5, value: 3 },
    { direction: 'left', x: 3, y: 5, value: -3 },
  ] as const)('gives the movement along $direction', ({ direction, x, y, value }) => {
    expect(along(direction, x, y)).toBe(value);
  });

  it('gives a movement toward a direction on its axis', () => {
    expect(toward('up', 10)).toEqual({ x: 0, y: -10 });
    expect(toward('right', 10)).toEqual({ x: 10, y: 0 });
  });

  it('grows as a square root against the direction', () => {
    expect(resist(16)).toBe(16);
    expect(resist(-16)).toBe(-4);
  });
});

describe('closesAtRelease', () => {
  it('closes past half of the popup, and past 10 px for a small popup', () => {
    expect(closesAtRelease(200, 101, 0)).toBe(true);
    expect(closesAtRelease(200, 100, 0)).toBe(false);
    expect(closesAtRelease(4, 10, 0)).toBe(false);
    expect(closesAtRelease(4, 11, 0)).toBe(true);
  });

  it('closes a drag toward the closed place at 0.5 px/ms or more', () => {
    expect(closesAtRelease(200, 20, 0.5)).toBe(true);
    expect(closesAtRelease(200, 20, 0.49)).toBe(false);
  });

  it('keeps open a drag that ends at or behind its start', () => {
    expect(closesAtRelease(200, 0, 2)).toBe(false);
    expect(closesAtRelease(200, -120, 2)).toBe(false);
  });
});

describe('opensAtRelease', () => {
  it('stays open at half of the popup, or at 0.1 px/ms', () => {
    expect(opensAtRelease(200, 100, 0)).toBe(true);
    expect(opensAtRelease(200, 99, 0)).toBe(false);
    expect(opensAtRelease(200, 10, 0.1)).toBe(true);
  });

  it('needs 40 px while the popup has no size', () => {
    expect(opensAtRelease(null, 40, 0)).toBe(true);
    expect(opensAtRelease(null, 39, 0)).toBe(false);
  });
});

describe('releaseStrength', () => {
  it('gives 1 with no speed and at the closed place', () => {
    expect(releaseStrength(300, 100, 0)).toBe(1);
    expect(releaseStrength(300, 300, 2)).toBe(1);
    expect(releaseStrength(0, 0, 2)).toBe(1);
  });

  it('gives the part of the leave from the distance that is left and the speed', () => {
    // 200 px at 1 px/ms take 200 ms, from 80 ms to 360 ms.
    expect(releaseStrength(300, 100, 1)).toBeCloseTo(0.1 + (120 / 280) * 0.9);
    expect(releaseStrength(300, 100, 4)).toBeCloseTo(0.1);
    expect(releaseStrength(300, 0, 0.3)).toBe(1);
  });
});

describe('pressStartsSwipe', () => {
  it('starts in the popup, and not outside it', () => {
    html(`<div id="viewport"><div id="popup"><p id="text">Text</p></div><p id="out">Out</p></div>`);
    expect(pressOn(byId('text'), byId('popup'))).toBe(true);
    expect(pressOn(byId('popup'), byId('popup'))).toBe(true);
    expect(pressOn(byId('out'), byId('popup'))).toBe(false);
  });

  it.each([
    ['button', '<button id="target">B</button>'],
    ['link', '<a id="target" href="#x">A</a>'],
    ['role button', '<span role="button"><span id="target">B</span></span>'],
    ['label', '<label><span id="target">L</span><input></label>'],
    ['swipe ignore', '<div data-vase-ui-swipe-ignore="x"><span id="target">I</span></div>'],
    [
      'scroller',
      `<div style="${SCROLLER}"><p id="target" style="height: 200px">Long</p></div>`,
    ],
  ])('starts no swipe on a %s', (_, markup) => {
    html(`<div id="popup">${markup}</div>`);
    expect(pressOn(byId('target'), byId('popup'))).toBe(false);
  });

  it('starts on a popup that scrolls itself, and in a scroller with no more content', () => {
    html(`<div id="popup" style="${SCROLLER}"><div style="overflow-y: auto">
      <p id="target" style="height: 200px">Long</p></div></div>`);
    expect(pressOn(byId('target'), byId('popup'))).toBe(true);
  });

  it('reads the path through a shadow root', () => {
    html(`<div id="popup"><div id="host"></div></div>`);
    const shadow = byId('host').attachShadow({ mode: 'open' });
    shadow.innerHTML = '<button>B</button><p>Text</p>';
    expect(pressOn(shadow.querySelector('button')!, byId('popup'))).toBe(false);
    expect(pressOn(shadow.querySelector('p')!, byId('popup'))).toBe(true);
  });
});

describe('ignoresTouch', () => {
  it('ignores an element with no value, the value of the axis of the drawer and a range input', () => {
    html(`<div id="viewport"><div data-vase-ui-swipe-ignore><i id="a"></i></div>
      <div data-vase-ui-swipe-ignore="y"><i id="b"></i></div>
      <div data-vase-ui-swipe-ignore="x"><i id="c"></i></div>
      <input id="d" type="range"></div>`);
    const viewport = byId('viewport');
    expect(ignoresTouch(pathOf(byId('a'), viewport), 'y')).toBe(true);
    expect(ignoresTouch(pathOf(byId('b'), viewport), 'y')).toBe(true);
    expect(ignoresTouch(pathOf(byId('c'), viewport), 'y')).toBe(false);
    expect(ignoresTouch(pathOf(byId('c'), viewport), 'x')).toBe(true);
    expect(ignoresTouch(pathOf(byId('d'), viewport), 'y')).toBe(true);
  });
});

describe('claimsTouch', () => {
  function scroller(scrollTop: number) {
    html(`<div id="viewport"><div id="popup"><div id="scroller" style="${SCROLLER}">
      <p id="target" style="height: 200px">Long</p></div></div></div>`);
    byId('scroller').scrollTop = scrollTop;
    return pathOf(byId('target'), byId('viewport'));
  }

  it('gives the browser a move that is more across the axis than on it', () => {
    html(`<div id="viewport"><p id="target">Text</p></div>`);
    const path = pathOf(byId('target'), byId('viewport'));
    expect(claimsTouch(path, 'down', 7, 6)).toBe(false);
    expect(claimsTouch(path, 'down', 6, 6)).toBe(true);
    expect(claimsTouch(path, 'down', 0, -6)).toBe(true);
  });

  it('takes a move toward the closed place from a scroller at its edge', () => {
    const path = scroller(0);
    expect(claimsTouch(path, 'down', 0, 6)).toBe(true);
    expect(claimsTouch(path, 'down', 0, -6)).toBe(false);
  });

  it('gives the browser each move in a scroller that is not at its edge', () => {
    const path = scroller(40);
    expect(claimsTouch(path, 'down', 0, 6)).toBe(false);
    expect(claimsTouch(path, 'down', 0, -6)).toBe(false);
  });

  it('reads the end of a scroller for a drawer that closes up', () => {
    const path = scroller(1000);
    expect(claimsTouch(path, 'up', 0, -6)).toBe(true);
    expect(claimsTouch(path, 'up', 0, 6)).toBe(false);
  });

  it('reads no scroller on the other axis', () => {
    html(`<div id="viewport"><div style="overflow-x: auto; width: 50px">
      <p id="target" style="width: 200px">Wide</p></div></div>`);
    expect(claimsTouch(pathOf(byId('target'), byId('viewport')), 'down', 0, 6)).toBe(true);
  });
});
