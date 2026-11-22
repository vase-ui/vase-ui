import { afterEach, describe, expect, it, onTestFinished } from 'vitest';
import { effectScope } from 'vue';
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
  useSwipeTracker,
  type SwipeRelease,
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
    ['scroller', `<div style="${SCROLLER}"><p id="target" style="height: 200px">Long</p></div>`],
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

describe('useSwipeTracker', () => {
  /** A tracker of the axis `y` on a new element, and the release of each drag. */
  function track() {
    const element = html('<div></div>').firstElementChild!;
    const releases: (SwipeRelease | null)[] = [];
    const scope = effectScope();
    const tracker = scope.run(() =>
      useSwipeTracker({
        axis: () => 'y',
        press: () => true,
        start() {},
        move() {},
        end: (release) => releases.push(release),
      }),
    )!;
    onTestFinished(() => scope.stop());
    for (const [name, listener] of Object.entries(tracker.listeners)) {
      element.addEventListener(name.slice(2).toLowerCase(), listener as EventListener);
    }
    /** Sends a pointer event of the mouse at `y`, with `x` 0, at the time `time` in ms. */
    const send = (type: string, y: number, time: number, pointerId = 1) => {
      const event = new PointerEvent(type, {
        pointerId,
        pointerType: 'mouse',
        clientY: y,
        buttons: type === 'pointerup' ? 0 : 1,
      });
      Object.defineProperty(event, 'timeStamp', { value: time });
      element.dispatchEvent(event);
    };
    return { releases, send };
  }

  /** The release of a press at 0 at the time 1000, the moves `[time, y]` and a release. */
  function drag(moves: [time: number, y: number][], release: [time: number, y: number]) {
    const { releases, send } = track();
    send('pointerdown', 0, 1000);
    for (const [time, y] of moves) send('pointermove', y, time);
    send('pointerup', release[1], release[0]);
    return releases[0]!;
  }

  it('gives the speed of the drag from the first move to the release', () => {
    const release = drag(
      [
        [1100, 0],
        [1200, 50],
      ],
      [1300, 50],
    );
    expect(release.velocityY).toBeCloseTo(0.25, 4);
    expect(release.velocityX).toBe(0);
  });

  it('counts the speed of the drag over 50 ms at least', () => {
    expect(
      drag(
        [
          [1005, 0],
          [1010, 30],
        ],
        [1015, 30],
      ).velocityY,
    ).toBeCloseTo(0.6, 4);
  });

  it.each([
    {
      name: 'the last sample',
      moves: [
        [1100, 0],
        [1200, 50],
        [1216, 70],
      ],
      release: [1224, 70],
      speed: 1.25,
    },
    {
      name: 'a 60 Hz input',
      moves: [
        [1016, 14.4],
        [1032, 28.8],
        [1048, 43.2],
        [1064, 57.6],
      ],
      release: [1080, 57.6],
      speed: 0.9,
    },
    {
      name: 'a 120 Hz input',
      moves: [
        [1008, 7.2],
        [1016, 14.4],
        [1024, 21.6],
        [1032, 28.8],
      ],
      release: [1040, 28.8],
      speed: 0.9,
    },
    {
      name: 'a slower last step',
      moves: [
        [1008, 10],
        [1016, 20],
        [1024, 30],
        [1032, 31],
      ],
      release: [1040, 31],
      speed: 0.125,
    },
    {
      name: 'a flick after a rest',
      moves: [
        [1008, 10],
        [1016, 20],
        [1216, 30],
        [1224, 40],
      ],
      release: [1232, 40],
      speed: 1.25,
    },
    {
      name: 'two samples 2 ms apart, counted over 4 ms',
      moves: [
        [1008, 10],
        [1010, 18],
      ],
      release: [1018, 18],
      speed: 2,
    },
    {
      name: 'sparse moves and one still move',
      moves: [
        [1060, 20],
        [1120, 200],
        [1128, 200.5],
      ],
      release: [1136, 200.5],
      speed: 3,
    },
    {
      name: 'a first move long after the press',
      moves: [
        [1200, 5],
        [1208, 15],
      ],
      release: [1216, 15],
      speed: 1.25,
    },
    {
      name: 'a pointer that rests for three moves',
      moves: [
        [1000, 0],
        [1016, 20],
        [1032, 20],
        [1048, 20],
        [1064, 20],
      ],
      release: [1072, 20],
      speed: 0,
    },
  ] as { name: string; moves: [number, number][]; release: [number, number]; speed: number }[])(
    'gives the speed of the last sample that moved: $name',
    ({ moves, release, speed }) => {
      expect(drag(moves, release).lastVelocityY).toBeCloseTo(speed, 4);
    },
  );

  it.each([
    { still: 1040, release: 1048, speed: 2.5 },
    { still: 1040, release: 1113, speed: 0 },
    { still: 1113, release: 1121, speed: 0 },
  ])(
    'keeps the last sample over one still move at $still ms, and not after 80 ms: release at $release ms',
    ({ still, release, speed }) => {
      const moves: [number, number][] = [
        [1008, 20],
        [1016, 40],
        [1024, 60],
        [1032, 80],
        [still, 80.5],
      ];
      expect(drag(moves, [release, 80.5]).lastVelocityY).toBeCloseTo(speed, 4);
    },
  );

  it('gives no release, and so no speed of an earlier drag, to a press with no move', () => {
    const { releases, send } = track();
    send('pointerdown', 0, 1000);
    send('pointermove', 40, 1008);
    send('pointermove', 120, 1016);
    send('pointerup', 120, 1024);
    expect(releases[0]?.lastVelocityY).toBeGreaterThan(1);
    send('pointerdown', 0, 5000, 2);
    send('pointerup', 0, 5016, 2);
    expect(releases).toHaveLength(1);
  });
});
