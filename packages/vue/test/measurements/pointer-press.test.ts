// Measurements with native elements, with no code of the library. Each one states what the browser
// does with a press that captures its pointer, so that `usePointerPress` of `src/common` has code
// only where the browser does not do it. Slider and Resizable use it. Where the browsers differ,
// the measurement states each one.
import { afterEach, describe, expect, onTestFinished, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { settle } from '../render';

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

const firefox = server.browser === 'firefox';

function center(element: Element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Presses the real mouse at `from`. The press moves to `to` and ends there. */
async function mousePress(from: { x: number; y: number }, to = from) {
  let held = true;
  onTestFinished(async () => {
    if (held) await userEvent.pointer({ coords: to, keys: '[/MouseLeft]' });
  });
  await userEvent.pointer({ coords: from, keys: '[MouseLeft>]' });
  return {
    move: () => userEvent.pointer({ coords: to }),
    release: async () => {
      held = false;
      await userEvent.pointer({ coords: to, keys: '[/MouseLeft]' });
    },
  };
}

describe('pointer capture in pointerdown', () => {
  function captured() {
    html(`<div id="capture" style="width:100px;height:40px;touch-action:none"></div>
      <iframe id="frame" style="width:200px;height:100px;border:0"></iframe>
      <div id="away" style="width:100px;height:40px"></div>`);
    const element = root!.querySelector<HTMLElement>('#capture')!;
    const log: string[] = [];
    element.addEventListener('pointerdown', (event) => element.setPointerCapture(event.pointerId));
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      element.addEventListener(type, () => log.push(`element ${type}`));
      document.addEventListener(type, (event) => {
        if (event.target !== element) log.push(`document ${type}`);
      });
    }
    return { element, log };
  }

  test.each(['away', 'frame'])(
    'a release over the element "%s" gives the capture element pointerup in each browser',
    async (where) => {
      const { element, log } = captured();
      const press = await mousePress(center(element), center(root!.querySelector(`#${where}`)!));
      await press.move();
      await press.release();
      await settle();
      expect(log).toEqual(['element pointerup', 'element lostpointercapture']);
    },
  );

  // The page of the tests gets no event outside its view in Firefox. The next move there has no
  // button down, so that move ends a press.
  test('a release outside the view gives pointerup in Chromium and WebKit; in Firefox the next move has buttons 0', async () => {
    const { element, log } = captured();
    element.addEventListener('pointermove', (event) => {
      if (event.buttons === 0) log.push('element move with no button');
    });
    const press = await mousePress(center(element), { x: -5, y: -5 });
    await press.move();
    await press.release();
    await userEvent.pointer({ coords: center(root!.querySelector('#away')!) });
    await settle();
    expect(log.filter((entry) => entry !== 'element move with no button')).toEqual(
      firefox ? [] : ['element pointerup', 'element lostpointercapture'],
    );
    if (firefox) expect(log).toContain('element move with no button');
  });

  test('a removed capture element gets no event; the document gets pointerup', async () => {
    const { element, log } = captured();
    const press = await mousePress(center(element), center(root!.querySelector('#away')!));
    element.remove();
    await press.move();
    await press.release();
    await settle();
    // The document gets `lostpointercapture` too in WebKit, and in Firefox in some runs.
    expect(log.filter((entry) => entry.startsWith('element'))).toEqual([]);
    expect(log).toContain('document pointerup');
  });

  test('setPointerCapture throws NotFoundError for a pointerdown that a script makes', () => {
    html('<div></div>');
    const element = root!.querySelector('div')!;
    let thrown = '';
    element.addEventListener('pointerdown', (event) => {
      try {
        element.setPointerCapture(event.pointerId);
      } catch (error) {
        thrown = (error as DOMException).name;
      }
    });
    element.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, bubbles: true }));
    expect(thrown).toBe('NotFoundError');
  });
});
