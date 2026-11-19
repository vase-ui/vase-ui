import { describe, expect, inject, onTestFinished, test } from 'vitest';
import { nextTick, reactive } from 'vue';
import ResizableLatePanel from '../../test/fixtures/ResizableLatePanel.vue';
import ResizableLayoutFixture from '../../test/fixtures/ResizableLayout.vue';
import ResizableReadAtMount from '../../test/fixtures/ResizableReadAtMount.vue';
import { hydrate, mount, renderOnServer, settle } from '../../test/render';
import { byKey, panelsAndHandles, type LayoutSpec } from '../../test/resizable';
import { waitFor } from '../../test/waitFor';

/** Renders the layout on a server, and gives the HTML before and after the hydration. */
async function serverLayout(server: LayoutSpec, client: LayoutSpec = server) {
  const container = await renderOnServer('ResizableLayout', { spec: server });
  const html = container.innerHTML;
  const at = (key: string) => byKey(container, key);
  return {
    container,
    html,
    at,
    async hydrate() {
      const spec = reactive(structuredClone(client));
      hydrate(ResizableLayoutFixture, { spec }, container);
      await settle();
      return spec;
    },
  };
}

const grows = (container: Element) =>
  [...container.querySelectorAll<HTMLElement>('[id]:not(button)')].map(
    (each) => each.style.flexGrow,
  );

const handleValues = (handle: HTMLElement) =>
  [
    'tabindex',
    'aria-controls',
    'aria-valuenow',
    'aria-valuemin',
    'aria-valuemax',
    'data-at-min',
    'data-at-max',
  ].map((name) => handle.getAttribute(name));

describe('the server HTML', () => {
  test('has the layout of all the parts: the style of each panel and the value of each handle', async () => {
    const { at, container } = await serverLayout({
      parts: panelsAndHandles('a', 'b', 'c').map((each) =>
        each.key === 'a' ? { ...each, attrs: { defaultSize: 30, minSize: 10 } } : each,
      ),
    });
    expect(grows(container)).toEqual(['30', '35', '35']);
    expect(at('a').style.getPropertyValue('--resizable-panel-size')).toBe('30');
    expect(at('a').style.flexBasis).toBe('0px');
    expect(handleValues(at('h1'))).toEqual(['0', 'a', '30', '10', '100', null, null]);
    expect(handleValues(at('h2'))).toEqual(['0', 'b', '35', '0', '70', null, null]);
    expect(at('root').style.display).toBe('flex');
  });

  test('has the layout of the root and of a nested root; a collapsed panel and the end of a handle; data-allow-mismatch on each panel', async () => {
    const { at, container } = await serverLayout({
      root: { defaultLayout: { a: 0, b: 100 } },
      parts: [
        { kind: 'panel', key: 'a', attrs: { collapsible: true, minSize: 20 } },
        { kind: 'handle', key: 'h1' },
        {
          kind: 'panel',
          key: 'b',
          inner: {
            root: { orientation: 'vertical', defaultLayout: { x: 25 } },
            parts: panelsAndHandles('x', 'y'),
          },
        },
      ],
    });
    expect(grows(container)).toEqual(['0', '100', '25', '75']);
    expect(at('a')).toHaveAttribute('data-collapsed', '');
    expect(at('b')).not.toHaveAttribute('data-collapsed');
    expect(at('a')).toHaveAttribute('data-allow-mismatch', 'style');
    expect(handleValues(at('h1')).slice(5)).toEqual(['', null]);
    // The slot state is the state of the first client render.
    expect(JSON.parse(at('a').querySelector('.panel-state')!.textContent!)).toEqual({
      orientation: 'horizontal',
      size: 0,
      collapsed: true,
      disabled: false,
    });
    expect(JSON.parse(at('h1').querySelector('.handle-state')!.textContent!)).toEqual(
      expect.objectContaining({ atMin: false, atMax: false }),
    );
  });

  test('a handle keeps the tab stop and the pointer target of the first client render; a disabled one has neither, and no end', async () => {
    const { at } = await serverLayout({
      parts: [
        { kind: 'handle', key: 'first' },
        ...panelsAndHandles('a', 'b'),
        { kind: 'handle', key: 'off', attrs: { disabled: true } },
        { kind: 'panel', key: 'c' },
      ],
    });
    expect(handleValues(at('first'))).toEqual(['0', null, null, null, null, '', '']);
    expect(at('first').lastElementChild).not.toHaveStyle({ pointerEvents: 'none' });
    expect(handleValues(at('off'))).toEqual([null, 'b', null, null, null, null, null]);
    expect(at('off')).toHaveAttribute('aria-disabled', 'true');
    expect((at('off').lastElementChild as HTMLElement).style.pointerEvents).toBe('none');
  });

  test('a first size in a length: flex 0 1 L, no variable, and no value for each handle of the root', async () => {
    const { at, container } = await serverLayout({
      parts: panelsAndHandles('a', 'b').map((each) =>
        each.key === 'a'
          ? { ...each, attrs: { defaultSize: '240px', rootResizeBehavior: 'fixed' } }
          : each,
      ),
    });
    expect(at('a').style.flex).toBe('0 1 240px');
    expect(at('a').style.getPropertyValue('--resizable-panel-size')).toBe('');
    expect(grows(container)).toEqual(['0', '100']);
    expect(at('h1')).not.toHaveAttribute('aria-valuenow');
  });
});

describe('the hydration', () => {
  test.each([
    {
      name: 'defaults',
      spec: {
        parts: panelsAndHandles('a', 'b', 'c').map((each) =>
          each.key === 'a' ? { ...each, attrs: { defaultSize: 30 } } : each,
        ),
      },
      sizes: ['30', '35', '35'],
    },
    {
      name: 'a vertical root',
      spec: {
        root: { orientation: 'vertical', defaultLayout: { a: 40 } },
        parts: panelsAndHandles('a', 'b'),
      },
      sizes: ['40', '60'],
    },
    {
      name: 'a handle with no panel after it',
      spec: { parts: [...panelsAndHandles('a', 'b'), { kind: 'handle' as const, key: 'end' }] },
      sizes: ['50', '50'],
    },
    {
      name: 'generated ids',
      spec: {
        parts: panelsAndHandles('a', 'b').map((each) =>
          each.kind === 'panel' ? { ...each, attrs: { id: '' } } : each,
        ),
      },
      sizes: ['50', '50'],
    },
  ])('gives no message, and moves no panel: $name', async ({ spec, sizes }) => {
    const server = await serverLayout(spec as LayoutSpec);
    const { container } = server;
    container.style.width = '400px';
    const panels = () => [
      ...container.querySelectorAll<HTMLElement>('[data-key]:not([role]):not([data-key$="root"])'),
    ];
    const widths = panels().map((each) => each.getBoundingClientRect().width);
    const first = panels()[0]!;
    await server.hydrate();
    expect(panels()[0]).toBe(first);
    expect(panels().map((each) => each.getBoundingClientRect().width)).toEqual(widths);
    expect(panels().map((each) => each.style.flexGrow)).toEqual(sizes);
    for (const panel of panels()) expect(panel).not.toHaveAttribute('data-allow-mismatch');
  });

  test('after the mount, each attribute follows the client: a handle with no panel on one side loses its tab stop', async () => {
    const server = await serverLayout({
      parts: [...panelsAndHandles('a', 'b'), { kind: 'handle', key: 'end' }],
    });
    await server.hydrate();
    expect(handleValues(server.at('end'))).toEqual([null, null, null, null, null, '', '']);
    expect((server.at('end').lastElementChild as HTMLElement).style.pointerEvents).toBe('none');
  });

  // An entry below the least size collapses the panel only in the layout of all the parts. The
  // app reads another layout at the mount, so the next render must remove the attribute.
  test('a layout that the app reads at the mount: a collapsed panel of the server HTML loses data-collapsed, and the handle follows', async () => {
    const parts = panelsAndHandles('a', 'b', 'c').map((each) =>
      each.key === 'a' ? { ...each, attrs: { collapsible: true, minSize: 20 } } : each,
    );
    const server = await serverLayout({ root: { modelValue: { a: 5, b: 50, c: 45 } }, parts });
    expect(server.at('a')).toHaveAttribute('data-collapsed');
    expect(grows(server.container)).toEqual(['0', '55', '45']);
    const spec = reactive(structuredClone({ root: { modelValue: { a: 5, b: 50, c: 45 } }, parts }));
    hydrate(ResizableLayoutFixture, { spec }, server.container);
    spec.root.modelValue = { a: 40, b: 30, c: 30 };
    await settle();
    expect(server.at('a')).not.toHaveAttribute('data-collapsed');
    expect(grows(server.container)).toEqual(['40', '30', '30']);
    expect(handleValues(server.at('h1')).slice(1, 3)).toEqual(['a', '40']);
  });

  test('a panel that goes after the mount: the handles name their new neighbors', async () => {
    const server = await serverLayout({
      root: { defaultLayout: { a: 20, b: 40, c: 40 } },
      parts: panelsAndHandles('a', 'b', 'c'),
    });
    const spec = await server.hydrate();
    spec.parts.splice(3, 2);
    await settle();
    expect(grows(server.container)).toEqual(['33.333', '66.667']);
    expect(handleValues(server.at('h1'))).toEqual(['0', 'a', '33', '0', '100', null, null]);
  });

  test('a length: the server HTML keeps the panel inside a narrower root, the hydration moves no panel, and the handle gets its value', async () => {
    const spec: LayoutSpec = {
      parts: panelsAndHandles('a', 'b').map((each) =>
        each.key === 'a' ? { ...each, attrs: { defaultSize: '240px' } } : each,
      ),
    };
    const narrow = await serverLayout({ ...spec, frame: 'width: 200px; height: 100px' });
    expect(narrow.at('a').getBoundingClientRect().width).toBeCloseTo(200, 0);
    const server = await serverLayout(spec);
    const width = server.at('a').getBoundingClientRect().width;
    expect(width).toBeCloseTo(240, 0);
    await server.hydrate();
    expect(server.at('a').getBoundingClientRect().width).toBeCloseTo(width, 0);
    expect(server.at('h1')).toHaveAttribute('aria-valuenow', '60');
  });

  // A Vapor component of Vue 3.6 has no async `setup`, so a Vapor app with Vapor parts cannot render
  // the fixture.
  test.skipIf(inject('app') === 'vapor')(
    'a panel below an async setup: the server HTML of the panels beside it lacks it, and after the hydration each panel has the layout of all',
    async () => {
      const container = await renderOnServer('ResizableLatePanel');
      const panel = container.querySelector<HTMLElement>('#a')!;
      expect(grows(container)).toEqual(['50', '50', '33.333']);
      hydrate(ResizableLatePanel, {}, container);
      await waitFor(() => expect(panel.style.flexGrow).toBe('33.334'));
      expect(grows(container)).toEqual(['33.334', '33.333', '33.333']);
      expect(container.querySelector('#a')).toBe(panel);
    },
  );
});

describe('a client mount', () => {
  test('a child that reads its panel in onMounted finds the panel at its place', async () => {
    const widths: Record<string, number> = {};
    mount(ResizableReadAtMount, {
      log: { read: (key: string, width: number) => (widths[key] = width) },
    });
    expect(widths).toEqual({ a: 120, b: 180, c: 100 });
    await settle();
  });

  test('writes no end attribute and no value at the mount of a handle with a panel on each side', async () => {
    const changes: string[] = [];
    const observer = new MutationObserver((records) =>
      changes.push(
        ...records.map(
          (record) =>
            `${(record.target as Element).getAttribute('data-key')} ${record.attributeName}`,
        ),
      ),
    );
    observer.observe(document.body, {
      subtree: true,
      attributeFilter: ['data-at-min', 'data-at-max', 'data-collapsed'],
    });
    onTestFinished(() => observer.disconnect());
    const spec = reactive<LayoutSpec>({ parts: panelsAndHandles('a', 'b') });
    const { root } = mount(ResizableLayoutFixture, { spec });
    await settle();
    expect(byKey(root, 'h1')).toHaveAttribute('aria-valuenow', '50');
    changes.push(...observer.takeRecords().map((record) => String(record.attributeName)));
    expect(changes).toEqual([]);
    await nextTick();
  });
});
