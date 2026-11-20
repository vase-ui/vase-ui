// Measurements with native elements, with no code of the library, for TimeClock. Each one states
// what the browser does, so that a part has code only where it does not do it.
import { afterEach, describe, expect, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { holdPress } from '../pointer';

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

const center = (element: Element) => {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

describe('pointer capture', () => {
  // So the face takes the capture only for a trusted event.
  test('`setPointerCapture` throws `NotFoundError` for the pointer of an event that a script made', () => {
    const face = html('<div style="width:100px;height:100px"></div>').firstElementChild!;
    let error: unknown;
    face.addEventListener('pointerdown', (event) => {
      try {
        face.setPointerCapture((event as PointerEvent).pointerId);
      } catch (thrown) {
        error = thrown;
      }
    });
    face.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, bubbles: true }));
    expect((error as DOMException).name).toBe('NotFoundError');
  });

  // So a face that goes away during a press ends the press itself.
  test('an element that goes away during a press gets no more event of the pointer', async () => {
    const container = html('<div style="width:100px;height:100px"></div>');
    const face = container.firstElementChild!;
    const events: string[] = [];
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      face.addEventListener(type, () => events.push(type));
    }
    face.addEventListener('pointerdown', (event) =>
      face.setPointerCapture((event as PointerEvent).pointerId),
    );
    const { release } = await holdPress(face);
    face.remove();
    await release({ x: 1, y: 1 });
    expect(events).toEqual([]);
  });
});

describe('a range input', () => {
  // So the face gives the focus to its range input at a press. WebKit on Linux gives the focus.
  test('a press gives it the focus, except in WebKit on macOS', async () => {
    const container = html(
      '<div style="position:relative;width:200px;height:200px"><input type="range" style="position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0"></div>',
    );
    const range = container.querySelector('input')!;
    await userEvent.pointer({ coords: center(range), keys: '[MouseLeft]' });
    expect(document.activeElement === range).toBe(
      server.browser !== 'webkit' || server.platform !== 'darwin',
    );
  });

  // So the face handles each key: the arrows of a clock follow the clock, the keys wrap, and
  // Page Up moves 2 hours or 15 minutes.
  test('the keys: no wrap, Page Up moves a tenth of the range, and ArrowRight right to left subtracts in Chromium and Firefox and adds in WebKit', async () => {
    const container = html(
      '<input type="range" min="1" max="12" value="12"><input type="range" min="0" max="59" value="0"><input type="range" min="1" max="12" value="6" dir="rtl">',
    );
    const [hours, minutes, rtl] = container.querySelectorAll('input');
    hours!.focus();
    await userEvent.keyboard('{ArrowRight}');
    minutes!.focus();
    await userEvent.keyboard('{PageUp}');
    rtl!.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect([hours!.value, minutes!.value, rtl!.value]).toEqual([
      '12',
      '6',
      server.browser === 'webkit' ? '7' : '5',
    ]);
  });

  // So the face cancels Enter, which commits the time.
  test('Enter submits its form through the submit button in Chromium and WebKit, and not in Firefox', async () => {
    const form = html('<form><input type="range"><button>Go</button></form>').firstElementChild!;
    const submits: string[] = [];
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits.push('submit');
    });
    form.querySelector('input')!.focus();
    await userEvent.keyboard('{Enter}');
    expect(submits).toEqual(server.browser === 'firefox' ? [] : ['submit']);
  });
});
