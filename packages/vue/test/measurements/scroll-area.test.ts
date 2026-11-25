// Measurements with native elements, with no code of the library. Each one states what the browser
// does, so that a part of Scroll Area has code only where the browser does not do it.
import { afterEach, describe, expect, onTestFinished, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { createApp, h, nextTick, ref, vShow, withDirectives } from 'vue';
import { nextEvent } from '../animation';
import { takeReportedMessages } from '../reportedMessages';

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

function find(id: string) {
  return root!.querySelector<HTMLElement>(`#${id}`)!;
}

function centre(element: Element) {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

/** Presses the main button of the real pointer at `point`. The case releases it when it ends. */
async function press(point: { x: number; y: number }) {
  let held = true;
  onTestFinished(async () => {
    if (held) await userEvent.pointer({ coords: point, keys: '[/MouseLeft]' });
  });
  await userEvent.pointer({ coords: point, keys: '[MouseLeft>]' });
  return async (to: { x: number; y: number }) => {
    held = false;
    await userEvent.pointer({ coords: to, keys: '[/MouseLeft]' });
  };
}

const TRACK = `
  <div id="root" style="position: relative; width: 200px; height: 200px; background: #eee">
    <p style="margin: 0; padding: 8px">Some text in the scroll area that a person can select.</p>
    <div id="bar" style="position: absolute; top: 0; bottom: 0; right: 0; width: 20px">
      <div id="thumb" style="width: 20px; height: 40px; background: #333"></div>
    </div>
  </div>
  <p style="margin: 0">Some text after the scroll area that a person can select.</p>`;

function captureAtPress() {
  find('thumb').addEventListener('pointerdown', (event) => {
    find('thumb').setPointerCapture(event.pointerId);
  });
}

describe('pointer capture of a thumb during a press', () => {
  test.each(['pointer-events: none', 'display: none', 'removed'])(
    'with %s, the thumb gets the moves, the release and lostpointercapture; out of the DOM, the document gets lostpointercapture',
    async (change) => {
      html(TRACK);
      captureAtPress();
      const thumb = find('thumb');
      const events: string[] = [];
      const record = (event: Event) => {
        const target =
          event.target === thumb ? 'thumb' : event.target === document ? 'document' : 'other';
        events.push(`${target} ${event.type}`);
      };
      for (const type of ['pointermove', 'pointerup', 'lostpointercapture']) {
        document.addEventListener(type, record, true);
        onTestFinished(() => document.removeEventListener(type, record, true));
      }
      const start = centre(thumb);
      const release = await press(start);
      await userEvent.pointer({ coords: { x: start.x, y: start.y + 10 } });
      events.length = 0;
      if (change === 'removed') thumb.remove();
      else thumb.style.cssText += `;${change}`;
      const outside = { x: start.x + 100, y: start.y + 200 };
      await userEvent.pointer({ coords: outside });
      await release(outside);
      // The case states which target gets each event. For a removed thumb, WebKit can send
      // `lostpointercapture` before or after the next move.
      expect(new Set(events)).toEqual(
        new Set(
          change === 'removed'
            ? ['document lostpointercapture', 'other pointermove', 'other pointerup']
            : ['thumb pointermove', 'thumb pointerup', 'thumb lostpointercapture'],
        ),
      );
    },
  );
});

describe('text selection at a press on a scrollbar', () => {
  /** Drags the real pointer from `from` across the text, in steps, as a person does. */
  async function dragAcrossText(from: { x: number; y: number }) {
    const release = await press(from);
    const path = [
      ...Array.from({ length: 5 }, (_, step) => ({
        x: from.x + ((5 - from.x) * (step + 1)) / 5,
        y: from.y + ((5 - from.y) * (step + 1)) / 5,
      })),
      ...Array.from({ length: 5 }, (_, step) => ({
        x: 5 + 59 * (step + 1),
        y: 5 + 51 * (step + 1),
      })),
    ];
    for (const point of path) await userEvent.pointer({ coords: point });
    await release(path.at(-1)!);
    return getSelection()!.toString();
  }

  test.each([
    { name: 'a thumb drag, mousedown prevented', on: 'thumb', prevent: true, selected: false },
    { name: 'a track drag, mousedown prevented', on: 'bar', prevent: true, selected: false },
    { name: 'a track drag, mousedown not prevented', on: 'bar', prevent: false, selected: true },
  ])('$name', async ({ on, prevent, selected }) => {
    html(TRACK);
    captureAtPress();
    if (prevent) find('bar').addEventListener('mousedown', (event) => event.preventDefault());
    getSelection()!.removeAllRanges();
    const target = find(on);
    const box = target.getBoundingClientRect();
    const text = await dragAcrossText({ x: box.left + box.width / 2, y: box.bottom - 20 });
    expect(text !== '').toBe(selected);
  });

  test.each(['dblClick', 'tripleClick'] as const)(
    'a %s on a track whose mousedown is prevented selects no text',
    async (click) => {
      html(TRACK);
      find('bar').addEventListener('mousedown', (event) => event.preventDefault());
      getSelection()!.removeAllRanges();
      await userEvent[click](find('bar'));
      expect(getSelection()!.toString()).toBe('');
    },
  );
});

describe('the end of an animation in a scroll container', () => {
  // The transform of a child adds to the scroll size until the animation ends.
  const CONTAINER = `
    <style>@keyframes measure-slide { from { transform: translateX(600px) } to { transform: none } }</style>
    <div id="viewport" style="width: 200px; height: 200px; overflow: scroll">
      <div id="item" style="width: 100px; height: 50px"></div>
    </div>`;

  /**
   * Each observer gets a first report with the size at the start, so a case clears the log after
   * it. In WebKit, `ready` of a script animation can resolve before that report, in the same frame.
   */
  function watchViewport() {
    const viewport = find('viewport');
    const log: string[] = [];
    const firstReport = Promise.withResolvers<void>();
    const observer = new ResizeObserver(() => {
      log.push('report');
      firstReport.resolve();
    });
    observer.observe(viewport);
    onTestFinished(() => observer.disconnect());
    viewport.addEventListener('scroll', () => log.push('scroll'));
    return { viewport, log, firstReport: firstReport.promise };
  }

  test.each([
    {
      name: 'a CSS animation',
      type: 'animationend',
      start: (item: HTMLElement) => (item.style.animation = 'measure-slide 200ms'),
    },
    {
      name: 'a CSS transition',
      type: 'transitionend',
      start: (item: HTMLElement) => {
        item.style.transform = 'translateX(600px)';
        void item.offsetWidth;
        item.style.transition = 'transform 200ms';
        item.style.transform = 'none';
      },
    },
  ])(
    '$name sends its end event to the container, with the new scroll size, and no report and no scroll',
    async ({ type, start }) => {
      html(CONTAINER);
      const { viewport, log, firstReport } = watchViewport();
      await firstReport;
      log.length = 0;
      let scrollWidth = 0;
      viewport.addEventListener(type, () => (scrollWidth = viewport.scrollWidth));
      await nextEvent(viewport, type, { action: () => start(find('item')) });
      expect(scrollWidth).toBe(200);
      expect(log).toEqual([]);
    },
  );

  test('a script animation sends no event to an element, and its finished promise resolves with the new scroll size', async () => {
    html(CONTAINER);
    const { viewport, log, firstReport } = watchViewport();
    const events: string[] = [];
    for (const type of ['animationend', 'transitionend'])
      viewport.addEventListener(type, () => events.push(type));
    await firstReport;
    log.length = 0;
    const animation = find('item').animate(
      [{ transform: 'translateX(600px)' }, { transform: 'none' }],
      200,
    );
    await animation.finished;
    expect(viewport.scrollWidth).toBe(200);
    expect(events).toEqual([]);
    expect(log).toEqual([]);
  });
});

describe('hover during a drag with pointer capture', () => {
  test(':hover of the root and :active of the scrollbar stay while the pointer is outside the root', async () => {
    html(TRACK);
    captureAtPress();
    find('bar').addEventListener('mousedown', (event) => event.preventDefault());
    const start = centre(find('thumb'));
    const release = await press(start);
    const outside = { x: start.x + 200, y: start.y + 300 };
    await userEvent.pointer({ coords: { x: start.x, y: start.y + 5 } });
    await userEvent.pointer({ coords: outside });
    expect(find('root').matches(':hover')).toBe(true);
    expect(find('bar').matches(':active')).toBe(true);
    await release(outside);
  });
});

describe('the margins of a block with a set width', () => {
  test.each(['ltr', 'rtl'])(
    'in %s, margin-inline-start is the value of the CSS, and WebKit gives the used value of the end margin in right-to-left',
    (dir) => {
      html(`
      <div dir="${dir}" style="position: relative; width: 300px; height: 300px">
        <div id="bar" style="position: absolute; bottom: 0; inset-inline: 0; height: 10px; padding-inline: 4px">
          <div id="thumb" style="width: 50px; height: 10px; margin-inline: 8px"></div>
        </div>
      </div>`);
      const thumb = getComputedStyle(find('thumb'));
      const bar = getComputedStyle(find('bar'));
      const usedEnd = server.browser === 'webkit' && dir === 'rtl';
      expect(thumb.marginInlineStart).toBe('8px');
      expect([thumb.marginLeft, thumb.marginRight]).toEqual(
        usedEnd ? ['234px', '8px'] : ['8px', '8px'],
      );
      expect([bar.paddingLeft, bar.paddingRight]).toEqual(['4px', '4px']);
    },
  );
});

describe('the first report of a ResizeObserver', () => {
  test('comes in the first frame, after the frame callbacks; an element that a microtask of it adds is in that frame', async () => {
    const log: string[] = [];
    const onError = (event: ErrorEvent) => log.push(`error ${event.message}`);
    window.addEventListener('error', onError);
    onTestFinished(() => window.removeEventListener('error', onError));
    const observers: ResizeObserver[] = [];
    onTestFinished(() => observers.forEach((observer) => observer.disconnect()));
    html('');
    const viewport = root!.appendChild(document.createElement('div'));
    viewport.style.cssText = 'width: 200px; height: 200px; overflow: scroll';
    viewport.innerHTML = '<div style="height: 1000px"></div>';
    const first = new ResizeObserver(() => {
      log.push('report');
      queueMicrotask(() => {
        const bar = root!.appendChild(document.createElement('div'));
        bar.style.cssText = 'position: absolute; top: 0; right: 0; width: 10px; height: 200px';
        log.push(`bar ${bar.offsetHeight}`);
        const second = new ResizeObserver(() => log.push('bar report'));
        observers.push(second);
        second.observe(bar);
      });
    });
    observers.push(first);
    first.observe(viewport);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        log.push('frame 1');
        requestAnimationFrame(() => {
          log.push('frame 2');
          requestAnimationFrame(() => {
            log.push('frame 3');
            resolve();
          });
        });
      });
    });
    expect(log.filter((entry) => !entry.startsWith('error'))).toEqual([
      'frame 1',
      'report',
      'bar 200',
      'frame 2',
      'bar report',
      'frame 3',
    ]);
    expect(log.some((entry) => entry.startsWith('error ResizeObserver loop'))).toBe(true);
    takeReportedMessages();
  });
});

describe('the Tab key and scroll containers', () => {
  const SCROLLERS = `
    <style>.scroller { height: 60px; overflow: auto } .long { height: 300px }</style>
    <button id="start">Start</button>
    <div id="empty" class="scroller"><p>Text</p><div class="long"></div></div>
    <div id="withButton" class="scroller"><button id="button">Button</button><div class="long"></div></div>
    <div id="withInput" class="scroller"><input id="input" aria-label="Input"><div class="long"></div></div>
    <div id="withNegative" class="scroller"><button tabindex="-1">Not a tab stop</button><div class="long"></div></div>
    <button id="end">End</button>`;

  test('Chromium stops only at a scroll container with no tab stop in it, Firefox at each one, and WebKit at none', async () => {
    html(SCROLLERS);
    find('start').focus();
    const order: string[] = [];
    while (document.activeElement !== find('end') && order.length < 10) {
      await userEvent.keyboard('{Tab}');
      order.push(document.activeElement!.id);
    }
    expect(order).toEqual(
      {
        chromium: ['empty', 'button', 'input', 'withNegative', 'end'],
        firefox: ['empty', 'withButton', 'button', 'withInput', 'input', 'withNegative', 'end'],
        webkit: ['button', 'input', 'end'],
      }[server.browser],
    );
  });

  test('a focused scroll container keeps the focus when its tabindex goes from 0 to -1, and loses it in WebKit when tabindex is removed', async () => {
    html(SCROLLERS);
    const scroller = find('withButton');
    scroller.tabIndex = 0;
    scroller.focus();
    expect(scroller).toHaveFocus();
    scroller.tabIndex = -1;
    await new Promise(requestAnimationFrame);
    expect(scroller).toHaveFocus();

    scroller.tabIndex = 0;
    scroller.focus();
    expect(scroller).toHaveFocus();
    scroller.removeAttribute('tabindex');
    await new Promise(requestAnimationFrame);
    expect(document.activeElement).toBe(server.browser === 'webkit' ? document.body : scroller);
  });
});

describe('an inert ancestor and contenteditable', () => {
  test('gives isContentEditable false in WebKit after style resolves, and true in Chromium and Firefox', async () => {
    html('<div id="wrap" inert><div id="editable" contenteditable="true">Edit</div></div>');
    const editable = find('editable');
    await new Promise(requestAnimationFrame);
    expect(editable.isContentEditable).toBe(server.browser !== 'webkit');
    find('wrap').removeAttribute('inert');
    await new Promise(requestAnimationFrame);
    expect(editable.isContentEditable).toBe(true);
  });
});

describe('a MutationObserver and a control that Vue hides', () => {
  test('sees a control that v-show or a class hides only through style or class', async () => {
    html('<style>.gone { display: none }</style><div id="app"></div>');
    const shown = ref(true);
    const gone = ref(false);
    const app = createApp({
      render: () =>
        h('div', [
          withDirectives(h('button', { id: 'shown' }, 'Shown'), [[vShow, shown.value]]),
          h('button', { id: 'gone', class: { gone: gone.value } }, 'Gone'),
        ]),
    });
    app.mount(find('app'));
    onTestFinished(() => app.unmount());
    const records: string[] = [];
    const observer = new MutationObserver((list) => {
      for (const record of list) {
        records.push(`${(record.target as Element).id} ${record.type} ${record.attributeName}`);
      }
    });
    observer.observe(find('app'), { subtree: true, childList: true, attributes: true });
    onTestFinished(() => observer.disconnect());
    shown.value = false;
    gone.value = true;
    await nextTick();
    await Promise.resolve();
    // `v-show` writes its style in a hook after the patch.
    expect(records).toEqual(['gone attributes class', 'shown attributes style']);
  });
});

describe('content changes in a scroll container', () => {
  test('ResizeObserver on a scroll container misses content growth, while direct Text observation catches direct text changes without subtree', async () => {
    html(`
      <div id="scroller" style="width: 200px; height: 100px; overflow: scroll">Short<div id="nested"><span id="inner">Nested</span></div></div>
      <div id="blockScroller" style="width: 200px; height: 100px; overflow: scroll">
        <div id="box" style="height: 20px"></div>
      </div>`);
    const scroller = find('scroller');
    const inner = find('inner');
    const blockScroller = find('blockScroller');
    const box = find('box');
    const resized: string[] = [];
    let settled = false;
    const resizeObserver = new ResizeObserver((entries) => {
      if (!settled) return;
      for (const entry of entries) resized.push(entry.target.id);
    });
    resizeObserver.observe(scroller);
    resizeObserver.observe(blockScroller);
    resizeObserver.observe(box);
    onTestFinished(() => resizeObserver.disconnect());

    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    settled = true;

    const elementOnly: string[] = [];
    const narrow: string[] = [];
    const elementObserver = new MutationObserver((list) => {
      for (const record of list) elementOnly.push(record.type);
    });
    const narrowObserver = new MutationObserver((list) => {
      for (const record of list) narrow.push(record.type);
    });
    elementObserver.observe(scroller, { childList: true, characterData: true });
    narrowObserver.observe(scroller, { childList: true });
    narrowObserver.observe(scroller.firstChild!, { characterData: true });
    onTestFinished(() => {
      elementObserver.disconnect();
      narrowObserver.disconnect();
    });

    inner.firstChild!.textContent = 'Nested changed';
    await Promise.resolve();
    const afterNested = [...narrow];

    scroller.firstChild!.textContent = 'Line '.repeat(200);
    box.style.height = '500px';
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);

    expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);
    expect(blockScroller.scrollHeight).toBeGreaterThan(blockScroller.clientHeight);
    expect(elementOnly).toEqual([]);
    expect(afterNested).toEqual([]);
    expect(narrow).toEqual(['characterData']);
    expect(resized).toEqual(['box']);
  });

  test('requestAnimationFrame and ResizeObserver in the same frame share document.timeline.currentTime', async () => {
    html('<div id="box" style="width: 100px; height: 100px"></div>');
    const box = find('box');
    const times: [string, CSSNumberish | null][] = [];
    const resizeObserver = new ResizeObserver(() => {
      times.push(['ro', document.timeline.currentTime]);
    });
    onTestFinished(() => resizeObserver.disconnect());

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        times.push(['raf1', document.timeline.currentTime]);
        resizeObserver.observe(box);
        requestAnimationFrame(() => {
          times.push(['raf2', document.timeline.currentTime]);
          resolve();
        });
      });
    });

    expect(times.map(([phase]) => phase)).toEqual(['raf1', 'ro', 'raf2']);
    expect(times[0]![1]).not.toBeNull();
    expect(times[1]![1]).toBe(times[0]![1]);
    expect(times[2]![1]).not.toBe(times[0]![1]);
  });
});
