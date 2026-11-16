import { describe, expect, it, vi } from 'vitest';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { Resizable } from '@vase-ui/vue/resizable';
import { takeReportedMessages } from '../../../test/reportedMessages';
import ResizableRootHydration from './ResizableRootHydration.test.vue';
import ResizableRootLatePanel from './ResizableRootLatePanel.test.vue';

const growsIn = (html: string) =>
  [...html.matchAll(/flex:([\d.]+) 1 0px/g)].map((match) => Number(match[1]));
const variablesIn = (html: string) =>
  [...html.matchAll(/--resizable-panel-size:([\d.]+)/g)].map((match) => Number(match[1]));
const valuesIn = (html: string) =>
  [...html.matchAll(/aria-valuenow="(\d+)"/g)].map((match) => Number(match[1]));

describe('<Resizable.Root /> on a server', () => {
  it('renders the layout of the panels, from the defaults of all of them', async () => {
    const html = await renderToString(
      createSSRApp(ResizableRootHydration, { composition: 'defaults' }),
    );

    expect(growsIn(html)).toEqual([30, 35, 35]);
    expect(variablesIn(html)).toEqual([30, 35, 35]);
  });

  it('renders the value of the panel before each handle', async () => {
    const html = await renderToString(
      createSSRApp(ResizableRootHydration, { composition: 'defaults' }),
    );

    expect(valuesIn(html)).toEqual([30, 35]);
    expect([...html.matchAll(/aria-valuemax="(\d+)"/g)].map((match) => Number(match[1]))).toEqual([
      100, 70,
    ]);
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-controls="a"');
    expect(html).toContain('aria-controls="b"');
  });

  it('renders the layout of the root, whatever the order of the parts', async () => {
    const html = await renderToString(
      createSSRApp(ResizableRootHydration, { composition: 'layout' }),
    );

    expect(growsIn(html)).toEqual([20, 80]);
    expect(valuesIn(html)).toEqual([20]);
  });

  it('renders the layout of each root for a panel in a component and a nested root', async () => {
    const html = await renderToString(
      createSSRApp(ResizableRootHydration, { composition: 'nested' }),
    );

    expect(growsIn(html)).toEqual([30, 70, 25, 75]);
    expect(valuesIn(html)).toEqual([30, 25]);
  });

  it('marks the style of each panel as a mismatch that the hydration accepts', async () => {
    const html = await renderToString(
      createSSRApp(ResizableRootHydration, { composition: 'defaults' }),
    );

    expect(html.match(/data-allow-mismatch="style"/g)).toHaveLength(3);
  });

  it('renders the attributes of the root, the panels and the handles', async () => {
    const html = await renderToString(
      createSSRApp(ResizableRootHydration, { composition: 'vertical' }),
    );

    expect(html).toContain('style="display:flex;flex-direction:column;"');
    expect(html).toContain('min-height:0');
    expect(html).not.toContain('min-width');
    expect(html).toContain('role="separator"');
    expect(html).toContain('aria-orientation="horizontal"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('data-orientation="vertical"');
  });

  it('keeps the style of a consumer beside the style of a panel', async () => {
    const html = await renderToString(
      createSSRApp(ResizableRootHydration, { composition: 'style' }),
    );

    expect(html).toMatch(/style="flex:30 1 0px;min-width:0;--resizable-panel-size:30;color:red;?"/);
    expect(growsIn(html)).toEqual([30, 70]);
  });

  it('renders the state of a collapsed panel and of the handle at the end of its travel', async () => {
    const html = await renderToString(
      createSSRApp(ResizableRootHydration, { composition: 'collapsed' }),
    );

    expect(growsIn(html)).toEqual([0, 100]);
    expect(html.match(/data-collapsed/g)).toHaveLength(1);
    expect(html.match(/data-at-min/g)).toHaveLength(1);
    expect(html).not.toContain('data-at-max');
    expect(valuesIn(html)).toEqual([0]);
  });

  it('renders no state of an end of the travel for a handle that is disabled', async () => {
    const html = await renderToString(
      <Resizable.Root>
        <Resizable.Panel id="a" collapsible minSize={20} defaultSize={0} disabled />
        <Resizable.Handle disabled />
        <Resizable.Panel id="b" />
      </Resizable.Root>,
    );

    expect(html).not.toContain('data-at-min');
    expect(html).not.toContain('data-at-max');
    expect(html).toContain('data-collapsed');
  });

  it('renders a handle that is disabled with no tab stop and no value', async () => {
    const html = await renderToString(
      <Resizable.Root>
        <Resizable.Panel id="a" />
        <Resizable.Handle disabled />
        <Resizable.Panel id="b" />
      </Resizable.Root>,
    );

    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('data-disabled');
    expect(html).not.toContain('tabindex');
    expect(html).not.toContain('aria-valuenow');
  });

  it('renders the value text of getAriaValueText with en-US and no pixelSize', async () => {
    const getAriaValueText = vi.fn(
      (text: string, _value: number, details: { pixelSize: number | undefined }) =>
        `${text} ${String(details.pixelSize)}`,
    );
    const html = await renderToString(
      <Resizable.Root>
        <Resizable.Panel id="a" defaultSize={30} />
        <Resizable.Handle getAriaValueText={getAriaValueText} />
        <Resizable.Panel id="b" />
        <Resizable.Handle />
        <Resizable.Panel id="c" />
      </Resizable.Root>,
    );

    expect(html).toContain('aria-valuetext="30% undefined"');
    expect(getAriaValueText).toHaveBeenCalledWith('30%', 30, {
      collapsed: false,
      pixelSize: undefined,
    });
  });

  describe('a first size that is a length', () => {
    it.each([
      { name: 'the size of a panel', composition: 'length', length: 'flex:0 1 240px' },
      { name: 'the layout of the root', composition: 'layoutLength', length: 'flex:0 1 15rem' },
    ])('renders a panel with $name in the unit that it has', async ({ composition, length }) => {
      const html = await renderToString(createSSRApp(ResizableRootHydration, { composition }));

      expect(html).toContain(length);
      // The other panel takes the rest, and only that panel has the size as a variable.
      expect(growsIn(html)).toEqual([100]);
      expect(variablesIn(html)).toEqual([100]);
    });

    it('renders the length of a panel whose entry in the layout is not a size', async () => {
      const html = await renderToString(
        <Resizable.Root defaultLayout={{ a: 'wide' }}>
          <Resizable.Panel id="a" defaultSize="240px" />
          <Resizable.Panel id="b" />
        </Resizable.Root>,
      );

      expect(html).toContain('flex:0 1 240px');
      expect(growsIn(html)).toEqual([100]);
      expect(takeReportedMessages()).toEqual([
        'console.warn: Vase UI: The layout gives the panel "a" the size "wide", which is not valid. The root ignores this size, so the panel takes its `defaultSize`, or an equal share of the space that is left. Use a number of 0 or more, or a string of such a number with an optional unit: "%", "px", "em", "rem", "vh" or "vw".',
      ]);
    });

    it('renders the length of a panel for a null layout', async () => {
      const html = await renderToString(
        <Resizable.Root layout={null}>
          <Resizable.Panel id="a" defaultSize="240px" />
          <Resizable.Panel id="b" />
        </Resizable.Root>,
      );

      expect(html).toContain('flex:0 1 240px');
      expect(growsIn(html)).toEqual([100]);
    });

    it('renders no value and no end of the travel for the handle', async () => {
      const html = await renderToString(
        createSSRApp(ResizableRootHydration, { composition: 'length' }),
      );

      expect(html).toContain('role="separator"');
      expect(html).toContain('aria-controls="a"');
      for (const name of ['aria-valuenow', 'aria-valuemin', 'aria-valuemax']) {
        expect(html).not.toContain(name);
      }
      expect(html).not.toContain('data-at-min');
      expect(html).not.toContain('data-at-max');
      expect(html).toContain('tabindex="0"');
    });

    it('renders the other panels in the ratio of their sizes, and no value for any handle', async () => {
      const html = await renderToString(
        createSSRApp(ResizableRootHydration, { composition: 'lengthMixed' }),
      );

      expect(html).toContain('flex:0 1 240px');
      expect(growsIn(html)).toEqual([30, 70]);
      expect(valuesIn(html)).toEqual([]);
      expect(html).not.toContain('aria-valuemin');
      expect(html.match(/aria-controls=/g)).toHaveLength(2);
    });

    it.each([{ id: 'a' }, { id: 'constructor' }, { id: 'toString' }, { id: '__proto__' }])(
      'renders the size 0 and no collapsed state for the panel $id',
      async ({ id }) => {
        const html = await renderToString(
          <Resizable.Root>
            <Resizable.Panel id={id} defaultSize="240px" collapsible minSize={20}>
              {{ default: ({ state }: { state: { size: number } }) => `size ${state.size}` }}
            </Resizable.Panel>
            <Resizable.Panel id="b" />
          </Resizable.Root>,
        );

        expect(html).toContain('size 0');
        expect(html).not.toContain('data-collapsed');
      },
    );

    it('renders a fixed panel as it renders a panel that is proportional', async () => {
      const html = await renderToString(
        createSSRApp(ResizableRootHydration, { composition: 'fixed' }),
      );

      expect(growsIn(html)).toEqual([20, 80]);
      expect(valuesIn(html)).toEqual([20]);
    });

    it('renders no event of the size of a panel', async () => {
      const onResize = vi.fn();
      await renderToString(
        <Resizable.Root>
          <Resizable.Panel defaultSize={30} onResize={onResize} />
          <Resizable.Panel />
        </Resizable.Root>,
      );

      expect(onResize).not.toHaveBeenCalled();
    });
  });

  describe('the hit area, and the edges', () => {
    const hitAreasIn = (html: string) =>
      [...html.matchAll(/<span data-vase-ui-resizable-hit-area style="([^"]*)"/g)].map(
        (match) => match[1],
      );

    it('renders a handle with position: relative and a hit area node with the fine size', async () => {
      const html = await renderToString(
        createSSRApp(ResizableRootHydration, { composition: 'defaults' }),
      );

      expect(html.match(/role="separator"[^>]*style="[^"]*position:relative/g)).toHaveLength(2);
      expect(hitAreasIn(html)).toEqual([
        'position:absolute;top:0;bottom:0;left:50%;width:max(100%, 10px);translate:-50% 0;z-index:1;',
        'position:absolute;top:0;bottom:0;left:50%;width:max(100%, 10px);translate:-50% 0;z-index:1;',
      ]);
    });

    it('renders the hit area of a vertical root on the vertical axis', async () => {
      const html = await renderToString(
        createSSRApp(ResizableRootHydration, { composition: 'vertical' }),
      );

      expect(hitAreasIn(html)).toEqual([
        'position:absolute;left:0;right:0;top:50%;height:max(100%, 10px);translate:0 -50%;z-index:1;',
      ]);
    });

    it.each([
      { name: 'a number', composition: 'hitAreaNumber', size: '16px' },
      { name: 'the fine size of an object', composition: 'hitAreaObject', size: '12px' },
    ])('renders the hit area with $name', async ({ composition, size }) => {
      const html = await renderToString(createSSRApp(ResizableRootHydration, { composition }));

      expect(hitAreasIn(html)[0]).toContain(`width:max(100%, ${size})`);
    });

    it('renders the hit area of a handle that is disabled with no pointer events', async () => {
      const html = await renderToString(
        <Resizable.Root>
          <Resizable.Panel />
          <Resizable.Handle disabled />
          <Resizable.Panel />
        </Resizable.Root>,
      );

      expect(hitAreasIn(html)[0]).toContain('pointer-events:none');
    });

    it('renders the hit area of a handle before the first panel as the hit area of a handle that can move', async () => {
      const html = await renderToString(
        createSSRApp(ResizableRootHydration, { composition: 'handleFirst' }),
      );

      expect(hitAreasIn(html)).toHaveLength(2);
      for (const style of hitAreasIn(html)) {
        expect(style).not.toContain('pointer-events');
      }
    });

    it('renders position: relative on a root with dragEdges, and no edge node', async () => {
      const html = await renderToString(
        createSSRApp(ResizableRootHydration, { composition: 'edges' }),
      );

      expect(html).toContain('style="display:flex;flex-direction:row;position:relative;"');
      expect(html).not.toContain('data-vase-ui-resizable-edge');
    });

    it('renders no position on a root with no dragEdges', async () => {
      const html = await renderToString(
        createSSRApp(ResizableRootHydration, { composition: 'defaults' }),
      );

      expect(html).toContain('style="display:flex;flex-direction:row;"');
    });
  });

  it('renders the panels beside a panel below an async setup without it', async () => {
    const html = await renderToString(createSSRApp(ResizableRootLatePanel));

    // The panels beside the late panel render before it registers. The late panel has the layout
    // of three panels, and the browser gives the same layout to all three after it hydrates.
    expect(growsIn(html)).toEqual([50, 50, 33.333]);
  });
});
