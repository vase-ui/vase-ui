import { describe, expect, onTestFinished, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { ResizableLayout, ResizableRootChangeEventDetails } from '@vase-ui/vue/resizable';
import ResizableLayoutFixture from '../../test/fixtures/ResizableLayout.vue';
import { penDrag, touchDrag } from '../../test/pointer';
import { mount, settle } from '../../test/render';
import {
  byKey,
  centerOf,
  drag,
  grows,
  moveTo,
  panelsAndHandles,
  press,
  release,
  widthOf,
  type LayoutSpec,
} from '../../test/resizable';
import { waitFor } from '../../test/waitFor';

async function mountLayout(spec: LayoutSpec, container?: ParentNode) {
  const layout = reactive(spec);
  const { root } = mount(ResizableLayoutFixture, { spec: layout }, container);
  await settle();
  return { root, spec: layout, at: (key: string) => byKey(root, key) };
}

/** Each event of the root as `name reason type`. */
function logged(log: string[]) {
  return {
    onLayoutChange: (_: ResizableLayout, details: ResizableRootChangeEventDetails) =>
      log.push(`layoutChange ${details.reason} ${details.event.type}`),
    'onUpdate:modelValue': () => log.push('update'),
    onLayoutCommitted: (_: ResizableLayout, details: { reason: string; event: Event }) =>
      log.push(`layoutCommitted ${details.reason} ${details.event.type}`),
    onDraggingChange: (dragging: boolean) => log.push(`draggingChange ${dragging}`),
  };
}

/** The id of the pointer of the next press on the element. */
function pointerOf(element: HTMLElement) {
  const pointer = { id: 0 };
  element.addEventListener('pointerdown', (event) => (pointer.id = event.pointerId));
  return pointer;
}

const three = () => panelsAndHandles('a', 'b', 'c');

describe('a drag', () => {
  test.each([
    { name: 'horizontal', orientation: 'horizontal', x: 40, y: 0 },
    { name: 'vertical', orientation: 'vertical', x: 0, y: 10 },
  ] as const)('moves the handle with the pointer in a $name root', async ({ orientation, x, y }) => {
    const { root, at } = await mountLayout({ root: { orientation }, parts: three() });
    await drag(at('h1'), x, y);
    expect(grows(root, 'a', 'b', 'c')).toEqual(['43.334', '23.333', '33.333']);
  });

  test('moves toward the previous panel in a right-to-left root', async () => {
    const { root, at } = await mountLayout({ root: { dir: 'rtl' }, parts: three() });
    await drag(at('h1'), -40);
    expect(grows(root, 'a', 'b', 'c')).toEqual(['43.334', '23.333', '33.333']);
  });

  test('each move starts from the layout at the press, and takes from the next panel, then from the one after it', async () => {
    const { root, at } = await mountLayout({
      root: { defaultLayout: { a: 30, b: 30, c: 40 } },
      parts: three().map((each) => (each.key === 'b' ? { ...each, attrs: { minSize: 20 } } : each)),
    });
    const start = await press(at('h1'));
    await moveTo({ x: start.x + 80, y: start.y });
    await moveTo({ x: start.x + 20, y: start.y });
    expect(grows(root, 'a', 'b', 'c')).toEqual(['35', '25', '40']);
    await moveTo({ x: start.x + 80, y: start.y });
    await release();
    expect(grows(root, 'a', 'b', 'c')).toEqual(['50', '20', '30']);
  });

  test('the handle stays under the pointer with padding and a border in the panels, and in a root that a transform scales', async () => {
    const padded = await mountLayout({
      parts: [
        { kind: 'panel', key: 'a', attrs: { style: 'padding: 0 20px; border: 5px solid' } },
        { kind: 'handle', key: 'h1', attrs: { style: 'flex: none; width: 4px' } },
        { kind: 'panel', key: 'b', attrs: { style: 'padding-left: 10px' } },
      ],
    });
    const before = padded.at('h1').getBoundingClientRect().left;
    await drag(padded.at('h1'), 30);
    expect(padded.at('h1').getBoundingClientRect().left - before).toBeCloseTo(30, 0);

    const scaled = await mountLayout({
      frame: 'width: 600px; height: 100px; transform: scale(0.5); transform-origin: 0 0',
      parts: [
        { kind: 'panel', key: 'a', attrs: { style: 'padding: 0 50px' } },
        { kind: 'handle', key: 'h1' },
        { kind: 'panel', key: 'b', attrs: { style: 'padding: 0 50px' } },
      ],
    });
    const start = scaled.at('h1').getBoundingClientRect().left;
    await drag(scaled.at('h1'), 25);
    expect(scaled.at('h1').getBoundingClientRect().left - start).toBeCloseTo(25, 0);
  });

  test('a press with another button starts nothing; a listener of the developer runs, and its preventDefault() stops nothing', async () => {
    const log: string[] = [];
    const downs: string[] = [];
    const { at } = await mountLayout({
      root: logged(log),
      parts: three().map((each) =>
        each.key === 'h1'
          ? {
              ...each,
              attrs: {
                onPointerdown: (event: PointerEvent) => {
                  downs.push(String(event.button));
                  event.preventDefault();
                },
              },
            }
          : each,
      ),
    });
    const at1 = centerOf(at('h1'));
    await userEvent.pointer({ coords: at1, keys: '[MouseRight>]' });
    await userEvent.pointer({ coords: { x: at1.x + 40, y: at1.y } });
    await userEvent.pointer({ keys: '[/MouseRight]' });
    expect(log).toEqual([]);
    await drag(at('h1'), 40);
    expect(downs).toEqual(['2', '0']);
    expect(log).toContain('layoutCommitted drag pointerup');
  });

  test('the events of a pointer that did not start the drag change nothing', async () => {
    const log: string[] = [];
    const { at } = await mountLayout({ root: logged(log), parts: three() });
    const start = await press(at('h1'));
    for (const type of ['pointermove', 'pointerup', 'pointercancel']) {
      at('h1').dispatchEvent(
        new PointerEvent(type, { pointerId: 99, buttons: 0, clientX: start.x + 100, bubbles: true }),
      );
    }
    expect(at('h1')).toHaveAttribute('data-dragging');
    await release();
    expect(log).toEqual(['draggingChange true', 'draggingChange false']);
  });

  test.each([
    { name: 'pointercancel', type: 'pointercancel' },
    { name: 'lostpointercapture', type: 'lostpointercapture' },
  ])('$name ends the drag and commits the last layout with its event', async ({ type }) => {
    const log: string[] = [];
    const { at } = await mountLayout({ root: logged(log), parts: three() });
    const pointer = pointerOf(at('h1'));
    const start = await press(at('h1'));
    await moveTo({ x: start.x + 40, y: start.y });
    at('h1').dispatchEvent(new PointerEvent(type, { pointerId: pointer.id, bubbles: true }));
    await nextTick();
    expect(at('h1')).not.toHaveAttribute('data-dragging');
    await release();
    expect(log.at(-1)).toBe(`layoutCommitted drag ${type}`);
  });

  test('a move with no button down ends the drag and commits, as Firefox gives for a release outside the view', async () => {
    const log: string[] = [];
    const { at } = await mountLayout({ root: logged(log), parts: three() });
    const pointer = pointerOf(at('h1'));
    const start = await press(at('h1'));
    await moveTo({ x: start.x + 40, y: start.y });
    at('h1').dispatchEvent(
      new PointerEvent('pointermove', { pointerId: pointer.id, buttons: 0, clientX: start.x + 40, bubbles: true }),
    );
    await nextTick();
    expect(at('h1')).not.toHaveAttribute('data-dragging');
    expect(log.at(-1)).toBe('layoutCommitted drag pointermove');
    await release();
  });

  test('the drag ends when the handle unmounts, and commits the last layout with the last move', async () => {
    const log: string[] = [];
    const { spec, at } = await mountLayout({ root: logged(log), parts: three() });
    const start = await press(at('h1'));
    await moveTo({ x: start.x + 40, y: start.y });
    spec.parts[1]!.show = false;
    await nextTick();
    expect(log.slice(-2)).toEqual(['draggingChange false', 'layoutCommitted drag pointermove']);
    await release();
  });

  test('the drag ends at the next move after a panel mounts', async () => {
    const log: string[] = [];
    const { spec, at } = await mountLayout({ root: logged(log), parts: three() });
    const start = await press(at('h1'));
    spec.parts.push({ kind: 'panel', key: 'late' });
    await settle();
    await moveTo({ x: start.x + 40, y: start.y });
    expect(at('h1')).not.toHaveAttribute('data-dragging');
    await release();
    expect(log.filter((each) => each.startsWith('layoutChange'))).toEqual([]);
  });

  test('the drag ends when the handle gets a new element', async () => {
    const { spec, at } = await mountLayout({ parts: three() });
    await press(at('h1'));
    expect(at('h1')).toHaveAttribute('data-dragging');
    spec.parts[1]!.key = 'h1-new';
    await settle();
    expect(at('h1-new')).not.toHaveAttribute('data-dragging');
    expect(byKey(document, 'root')).not.toHaveAttribute('data-dragging');
    await release();
  });

  test('follows the pointer over an iframe', async () => {
    const { root, at } = await mountLayout({ parts: three() });
    const frame = at('c').appendChild(document.createElement('iframe'));
    frame.srcdoc = '<p>Frame</p>';
    frame.style.cssText = 'width: 100%; height: 100%; border: 0';
    await waitFor(() => expect(frame.contentDocument?.body.textContent).toBe('Frame'));
    const start = await press(at('h2'));
    await moveTo({ x: start.x - 40, y: start.y });
    await moveTo({ x: start.x + 60, y: start.y });
    await release();
    expect(grows(root, 'a', 'b', 'c')).toEqual(['33.334', '48.333', '18.333']);
  });

  test('a single handle in a shadow tree drags', async () => {
    const host = document.body.appendChild(document.createElement('div'));
    onTestFinished(() => host.remove());
    const shadow = host.attachShadow({ mode: 'open' });
    const { root, at } = await mountLayout({ parts: three() }, shadow);
    await drag(at('h1'), 40);
    expect(grows(root, 'a', 'b', 'c')).toEqual(['43.334', '23.333', '33.333']);
  });
});

describe('the focus, the selection and the click', () => {
  // Each browser shows a ring for a focus that a script gives, unless a mouse gave the last focus.
  test('a press gives the handle the focus; after a focus that a mouse gave, with no focus ring', async () => {
    const { at, root } = await mountLayout({ parts: three().map((each) => (each.key === 'a' ? { ...each, controls: ['A'] } : each)) });
    await userEvent.click(root.querySelector<HTMLElement>('#A')!);
    await press(at('h1'));
    expect(at('h1')).toHaveFocus();
    expect(at('h1').matches(':focus-visible')).toBe(false);
    await release();
  });

  test('a drag across a paragraph selects no text', async () => {
    const { root, at } = await mountLayout({
      parts: [
        { kind: 'panel', key: 'a' },
        { kind: 'handle', key: 'h1' },
        { kind: 'panel', key: 'b', controls: [] },
        { kind: 'element', key: 'text', text: 'A drag across this text selects nothing.', attrs: { style: 'flex: none; width: 100px' } },
      ],
    });
    const start = await press(at('h1'));
    await moveTo({ x: start.x + 30, y: start.y });
    await moveTo({ x: start.x + 140, y: start.y + 10 });
    await release();
    expect(window.getSelection()?.toString()).toBe('');
    expect(root).toBeTruthy();
  });

  test('a listener of click runs after a press with no move, and not after a drag; the next press clears the rule', async () => {
    const clicks: number[] = [];
    const { at } = await mountLayout({
      parts: three().map((each) =>
        each.key === 'h1' ? { ...each, attrs: { onClick: (event: MouseEvent) => clicks.push(event.detail) } } : each,
      ),
    });
    await press(at('h1'));
    await release();
    expect(clicks).toEqual([1]);
    await drag(at('h1'), 40);
    expect(clicks).toEqual([1]);
    await press(at('h1'));
    await release();
    expect(clicks).toEqual([1, 1]);
    await drag(at('h1'), -20);
    at('h1').click();
    expect(clicks).toEqual([1, 1, 0]);
  });
});

describe('a handle with no size', () => {
  const thin = (style: string) => [
    { kind: 'panel' as const, key: 'a' },
    { kind: 'handle' as const, key: 'h1', attrs: { style } },
    { kind: 'panel' as const, key: 'b' },
  ];

  test('its pointer target takes a press within 5 px of its center, and the press focuses and drags it', async () => {
    const { root, at } = await mountLayout({ parts: thin('flex: none; width: 0px') });
    const center = centerOf(at('h1'));
    await userEvent.pointer({ coords: { x: center.x + 4, y: center.y }, keys: '[MouseLeft>]' });
    await moveTo({ x: center.x + 44, y: center.y });
    expect(at('h1')).toHaveFocus();
    await release();
    expect(grows(root, 'a', 'b')).toEqual(['60', '40']);
  });

  test('--resizable-handle-hit-area-size widens the target', async () => {
    const { root, at } = await mountLayout({
      parts: thin('flex: none; width: 0px; --resizable-handle-hit-area-size: 24px'),
    });
    const center = centerOf(at('h1'));
    await userEvent.pointer({ coords: { x: center.x + 10, y: center.y }, keys: '[MouseLeft>]' });
    await moveTo({ x: center.x + 50, y: center.y });
    await release();
    expect(grows(root, 'a', 'b')).toEqual(['60', '40']);
  });

  test('a layer over the handle takes the press', async () => {
    const { root, at } = await mountLayout({ parts: thin('flex: none; width: 0px') });
    const center = centerOf(at('h1'));
    const layer = document.body.appendChild(document.createElement('div'));
    onTestFinished(() => layer.remove());
    layer.style.cssText = `position: fixed; left: ${center.x - 20}px; top: ${center.y - 20}px; width: 40px; height: 40px; z-index: 2; background: white`;
    await userEvent.pointer({ coords: { x: center.x + 4, y: center.y }, keys: '[MouseLeft>]' });
    await moveTo({ x: center.x + 44, y: center.y });
    await release();
    expect(at('h1')).not.toHaveAttribute('data-dragging');
    expect(grows(root, 'a', 'b')).toEqual(['50', '50']);
  });
});

describe('resize mode on-release', () => {
  const onRelease = (log: string[], extra: Record<string, unknown> = {}) => ({
    resizeMode: 'on-release',
    ...logged(log),
    ...extra,
  });
  const offset = (handle: HTMLElement) =>
    handle.style.getPropertyValue('--resizable-handle-preview-offset');

  test('the layout stays during the moves; the release writes it one time, with the event of the release', async () => {
    const log: string[] = [];
    const { root, at } = await mountLayout({ root: onRelease(log), parts: three() });
    expect(offset(at('h1'))).toBe('');
    const start = await press(at('h1'));
    expect(offset(at('h1'))).toBe('0px');
    await moveTo({ x: start.x + 40, y: start.y });
    await moveTo({ x: start.x + 80, y: start.y });
    expect(log).toEqual(['draggingChange true']);
    expect(grows(root, 'a', 'b', 'c')).toEqual(['33.334', '33.333', '33.333']);
    expect(offset(at('h1'))).toBe('80px');
    expect(at('h2')).not.toHaveAttribute('data-dragging');
    expect(offset(at('h2'))).toBe('');
    await release();
    expect(log).toEqual([
      'draggingChange true',
      'draggingChange false',
      'layoutChange drag pointerup',
      'update',
      'layoutCommitted drag pointerup',
    ]);
    expect(grows(root, 'a', 'b', 'c')).toEqual(['53.334', '13.333', '33.333']);
    expect(offset(at('h1'))).toBe('');
  });

  test('a push moves the later handle, which gets its own distance with no data-dragging', async () => {
    const { at } = await mountLayout({
      root: { resizeMode: 'on-release', defaultLayout: { a: 30, b: 30, c: 40 } },
      parts: three().map((each) => (each.key === 'b' ? { ...each, attrs: { minSize: 20 } } : each)),
    });
    const start = await press(at('h1'));
    await moveTo({ x: start.x + 80, y: start.y });
    expect(offset(at('h1'))).toBe('80px');
    expect(offset(at('h2'))).toBe('40px');
    expect(at('h2')).not.toHaveAttribute('data-dragging');
    await release();
  });

  test('the distance has three decimals at the most', async () => {
    // In a root of 300 px, 1 px is 0.333 percent of the panel space.
    const { at } = await mountLayout({ frame: 'width: 300px; height: 100px', root: { resizeMode: 'on-release' }, parts: three() });
    const start = await press(at('h1'));
    await moveTo({ x: start.x + 1, y: start.y });
    expect(offset(at('h1'))).toBe('0.999px');
    await release();
  });

  test.each([
    { name: 'pointercancel', type: 'pointercancel' },
    { name: 'lostpointercapture', type: 'lostpointercapture' },
  ])('writes nothing after $name', async ({ type }) => {
    const log: string[] = [];
    const { root, at } = await mountLayout({ root: onRelease(log), parts: three() });
    const pointer = pointerOf(at('h1'));
    const start = await press(at('h1'));
    await moveTo({ x: start.x + 40, y: start.y });
    at('h1').dispatchEvent(new PointerEvent(type, { pointerId: pointer.id, bubbles: true }));
    await release();
    expect(log).toEqual(['draggingChange true', 'draggingChange false']);
    expect(grows(root, 'a', 'b', 'c')).toEqual(['33.334', '33.333', '33.333']);
  });

  test('a move with no button down writes the layout', async () => {
    const log: string[] = [];
    const { root, at } = await mountLayout({ root: onRelease(log), parts: three() });
    const pointer = pointerOf(at('h1'));
    const start = await press(at('h1'));
    await moveTo({ x: start.x + 40, y: start.y });
    at('h1').dispatchEvent(new PointerEvent('pointermove', { pointerId: pointer.id, buttons: 0, bubbles: true }));
    await nextTick();
    expect(log).toContain('layoutCommitted drag pointermove');
    expect(grows(root, 'a', 'b', 'c')).toEqual(['43.334', '23.333', '33.333']);
    await release();
  });

  test('writes nothing when the root becomes disabled, when a panel mounts, or for a release at the start point', async () => {
    for (const act of [
      async (spec: LayoutSpec) => {
        spec.root!.disabled = true;
        await nextTick();
      },
      async (spec: LayoutSpec) => {
        spec.parts.push({ kind: 'panel', key: 'late' });
        await settle();
      },
      async (_: LayoutSpec, start: { x: number; y: number }) => moveTo(start),
    ]) {
      const log: string[] = [];
      const { spec, at, root } = await mountLayout({ root: onRelease(log), parts: three() });
      const start = await press(at('h1'));
      await moveTo({ x: start.x + 40, y: start.y });
      await act(spec, start);
      await release();
      // A panel that mounts with no entry gives `update:modelValue` alone.
      expect(log.filter((each) => each.startsWith('layout'))).toEqual([]);
      root.remove();
    }
  });

  test('a cancel at the release keeps the layout; a key writes at once; a controlled root shows the layout of the parent', async () => {
    const log: string[] = [];
    const cancelled = await mountLayout({
      root: onRelease(log, { onLayoutChange: (_: unknown, details: { cancel(): void }) => details.cancel() }),
      parts: three(),
    });
    await drag(cancelled.at('h1'), 40);
    expect(log.filter((each) => each === 'update' || each.startsWith('layoutCommitted'))).toEqual([]);
    expect(grows(cancelled.root, 'a', 'b', 'c')).toEqual(['33.334', '33.333', '33.333']);

    const keyLog: string[] = [];
    const keys = await mountLayout({ root: onRelease(keyLog), parts: three() });
    keys.at('h1').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(keyLog).toEqual(['layoutChange keyboard keydown', 'update', 'layoutCommitted keyboard keydown']);

    const root = reactive<Record<string, unknown>>({ resizeMode: 'on-release', modelValue: { a: 30, b: 30, c: 40 } });
    root['onUpdate:modelValue'] = (layout: ResizableLayout) => (root.modelValue = layout);
    const controlled = await mountLayout({ root, parts: three() });
    await drag(controlled.at('h1'), 40);
    expect(grows(controlled.root, 'a', 'b', 'c')).toEqual(['40', '20', '40']);
  });

  test('the release collapses a panel past the threshold; the pending layout snaps; the mode of each drag is the mode at its press', async () => {
    const collapse = await mountLayout({
      root: { resizeMode: 'on-release' },
      parts: [
        { kind: 'panel', key: 'a', attrs: { collapsible: true, minSize: 20, defaultSize: 40 } },
        { kind: 'handle', key: 'h1' },
        { kind: 'panel', key: 'b' },
      ],
    });
    const start = await press(collapse.at('h1'));
    await moveTo({ x: start.x - 160, y: start.y });
    expect(offset(collapse.at('h1'))).toBe('-160px');
    expect(collapse.at('a')).not.toHaveAttribute('data-collapsed');
    await release();
    expect(collapse.at('a')).toHaveAttribute('data-collapsed');

    const snap = await mountLayout({ root: { resizeMode: 'on-release', dragStep: 10 }, parts: panelsAndHandles('a', 'b') });
    const snapStart = await press(snap.at('h1'));
    await moveTo({ x: snapStart.x + 55, y: snapStart.y });
    expect(offset(snap.at('h1'))).toBe('40px');
    await release();

    const log: string[] = [];
    const mode = await mountLayout({ root: { resizeMode: 'live', ...logged(log) }, parts: three() });
    const modeStart = await press(mode.at('h1'));
    mode.spec.root!.resizeMode = 'on-release';
    await nextTick();
    await moveTo({ x: modeStart.x + 20, y: modeStart.y });
    await release();
    expect(log.filter((each) => each.startsWith('layoutChange'))).toEqual(['layoutChange drag pointermove']);
  });
});

describe('the crossing of two handles', () => {
  // The outer root is 408 px wide with a handle of 8 px, so 1% of its panel space is 4 px. The
  // inner root is 208 px high with a handle of 8 px, so 1% of its panel space is 2 px. Each
  // pointer target is 24 px, so the two targets have 8 px in common on the axis of the outer root.
  async function mountCrossing(inner: Record<string, unknown> = {}) {
    const outerLog: string[] = [];
    const innerLog: string[] = [];
    const { root, at } = await mountLayout({
      frame: 'width: 408px; height: 208px; --resizable-handle-hit-area-size: 24px',
      root: logged(outerLog),
      parts: [
        { kind: 'panel', key: 'a' },
        { kind: 'handle', key: 'h1', attrs: { style: 'flex: none; width: 8px' } },
        {
          kind: 'panel',
          key: 'b',
          inner: {
            root: { orientation: 'vertical', ...logged(innerLog) },
            parts: [
              { kind: 'panel', key: 'x' },
              { kind: 'handle', key: 'h2', attrs: { style: 'flex: none; height: 8px', ...inner } },
              { kind: 'panel', key: 'y' },
            ],
          },
        },
      ],
    });
    const outer = at('h1');
    const innerHandle = root.querySelector<HTMLElement>('[data-key="h2"]')!;
    const outerRect = outer.getBoundingClientRect();
    const innerRect = innerHandle.getBoundingClientRect();
    return {
      outer,
      inner: innerHandle,
      outerLog,
      innerLog,
      // On the pointer targets of the two handles, 4 px right of the outer handle.
      junction: { x: outerRect.right + 4, y: innerRect.top + innerRect.height / 2 },
    };
  }

  const values = (outer: HTMLElement, inner: HTMLElement) => [
    outer.getAttribute('aria-valuenow'),
    inner.getAttribute('aria-valuenow'),
  ];

  test('a press at the junction moves both layouts by the two distances; each root emits its events one time', async () => {
    const { outer, inner, outerLog, innerLog, junction } = await mountCrossing();
    await userEvent.pointer({ coords: junction, keys: '[MouseLeft>]' });
    await moveTo({ x: junction.x + 40, y: junction.y + 20 });
    expect(outer).toHaveAttribute('data-dragging');
    expect(outer).toHaveAttribute('data-crossing');
    expect(inner).toHaveAttribute('data-dragging');
    expect(inner).toHaveAttribute('data-crossing');
    expect(JSON.parse(outer.querySelector('.handle-state')!.textContent!).crossing).toBe(true);
    expect(values(outer, inner)).toEqual(['60', '60']);
    await release();
    expect(values(outer, inner)).toEqual(['60', '60']);
    for (const log of [outerLog, innerLog]) {
      expect(log.filter((each) => each.startsWith('layoutCommitted'))).toHaveLength(1);
      expect(log.filter((each) => each.startsWith('draggingChange'))).toEqual([
        'draggingChange true',
        'draggingChange false',
      ]);
    }
    expect(outer).not.toHaveAttribute('data-crossing');
    expect(inner).not.toHaveAttribute('data-crossing');
  });

  test('a press away from the junction moves one layout', async () => {
    const { outer, inner, junction } = await mountCrossing();
    await userEvent.pointer({ coords: { x: junction.x, y: junction.y - 60 }, keys: '[MouseLeft>]' });
    await moveTo({ x: junction.x + 40, y: junction.y - 30 });
    expect(values(outer, inner)).toEqual(['60', '50']);
    expect(outer).not.toHaveAttribute('data-crossing');
    await release();
  });

  test('a pointer with no button at the junction gives data-crossing to the handle under it, until it leaves', async () => {
    const { outer, inner, junction } = await mountCrossing();
    await moveTo(junction);
    const under = document.elementFromPoint(junction.x, junction.y)!.closest('[role="separator"]');
    expect(under).toHaveAttribute('data-crossing');
    await moveTo({ x: junction.x, y: junction.y - 60 });
    expect(outer).not.toHaveAttribute('data-crossing');
    expect(inner).not.toHaveAttribute('data-crossing');
  });

  test('a disabled handle does not join', async () => {
    const { outer, inner, junction } = await mountCrossing({ disabled: true });
    await userEvent.pointer({ coords: junction, keys: '[MouseLeft>]' });
    await moveTo({ x: junction.x + 40, y: junction.y + 20 });
    expect(outer).not.toHaveAttribute('data-crossing');
    expect(values(outer, inner)).toEqual(['60', null]);
    await release();
  });

  test('a layer over the page covers the handles under it', async () => {
    const { outer, junction } = await mountCrossing();
    const layerLog: string[] = [];
    const layer = await mountLayout({
      frame: `position: fixed; left: 0; top: ${junction.y - 50}px; width: 408px; height: 108px; z-index: 2; background: white; --resizable-handle-hit-area-size: 24px`,
      root: { orientation: 'vertical', ...logged(layerLog) },
      parts: [
        { kind: 'panel', key: 'top' },
        { kind: 'handle', key: 'layer', attrs: { style: 'flex: none; height: 8px' } },
        { kind: 'panel', key: 'bottom' },
      ],
    });
    const at = { x: junction.x, y: centerOf(layer.at('layer')).y };
    await userEvent.pointer({ coords: at, keys: '[MouseLeft>]' });
    await moveTo({ x: at.x + 40, y: at.y + 10 });
    await release();
    expect(layer.at('layer')).toHaveAttribute('aria-valuenow', '60');
    expect(outer).toHaveAttribute('aria-valuenow', '50');
    expect(layerLog.filter((each) => each.startsWith('layoutCommitted'))).toHaveLength(1);
  });

  test('the click of the pressed handle stops after a crossing drag; a click that a script makes reaches the joined handle', async () => {
    const clicks: string[] = [];
    const { outer, inner, junction } = await mountCrossing({ onClick: () => clicks.push('inner') });
    outer.addEventListener('click', () => clicks.push('outer'));
    await userEvent.pointer({ coords: junction, keys: '[MouseLeft>]' });
    await moveTo({ x: junction.x + 40, y: junction.y + 20 });
    await release();
    expect(clicks).toEqual([]);
    inner.click();
    expect(clicks).toEqual(['inner']);
  });
});

// Only Chromium has the protocol that sends a real touch or a real pen.
describe('touch and pen of Chromium', () => {
  const chromium = server.browser === 'chromium';

  test.skipIf(!chromium)('a touch drag moves the layout, and the browser cancels no pointer', async () => {
    const cancels: string[] = [];
    const { root, at } = await mountLayout({
      parts: three().map((each) => (each.key === 'h1' ? { ...each, attrs: { onPointercancel: () => cancels.push('cancel') } } : each)),
    });
    const start = centerOf(at('h1'));
    await touchDrag({ x: start.x + 4, y: start.y }, { x: start.x + 44, y: start.y });
    expect(grows(root, 'a', 'b', 'c')).toEqual(['43.334', '23.333', '33.333']);
    expect(cancels).toEqual([]);
  });

  test.skipIf(!chromium)('a pen drag moves the layout and stops the click that follows; a pen press with no move gives the click', async () => {
    const clicks: string[] = [];
    const { root, at } = await mountLayout({
      parts: three().map((each) => (each.key === 'h1' ? { ...each, attrs: { onClick: () => clicks.push('click') } } : each)),
    });
    const start = centerOf(at('h1'));
    await penDrag(start, { x: start.x + 40, y: start.y });
    expect(grows(root, 'a', 'b', 'c')).toEqual(['43.334', '23.333', '33.333']);
    expect(clicks).toEqual([]);
    const moved = centerOf(at('h1'));
    await penDrag(moved, moved);
    await waitFor(() => expect(clicks).toEqual(['click']));
    expect(widthOf(at('a'))).toBeGreaterThan(0);
  });
});
