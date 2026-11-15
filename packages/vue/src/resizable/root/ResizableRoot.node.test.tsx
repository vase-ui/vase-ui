import { describe, expect, it } from 'vitest';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import * as Resizable from '../index.parts';
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

  it('renders the panels beside a panel below an async setup without it', async () => {
    const html = await renderToString(createSSRApp(ResizableRootLatePanel));

    // The panels beside the late panel render before it registers. The late panel has the layout
    // of three panels, and the browser gives the same layout to all three after it hydrates.
    expect(growsIn(html)).toEqual([50, 50, 33.333]);
  });
});
