import { expect, describe, it } from 'vitest';
import { h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { Collapsible } from '@vase-ui/vue/collapsible';

const PANEL_CONTENT = 'This is panel content';

// Vue 3.5.41 is the first version whose server writes the value of `hidden`. An earlier server
// writes a bare `hidden`.
const canWriteUntilFound = (await renderToString(h('div', { hidden: 'until-found' }))).includes(
  'hidden="until-found"',
);

/** The start tag of the panel, which has `data-testid="panel"`. */
function readPanelTag(html: string) {
  const tag = /<div[^>]*data-testid="panel"[^>]*>/.exec(html)?.[0];
  if (tag === undefined) {
    throw new Error(`The HTML has no panel:\n${html}`);
  }
  return tag;
}

/** The start tag of the trigger, the only `button` of the HTML. */
function readTriggerTag(html: string) {
  const tag = /<button[^>]*>/.exec(html)?.[0];
  if (tag === undefined) {
    throw new Error(`The HTML has no trigger:\n${html}`);
  }
  return tag;
}

/** The declarations of the `style` attribute of the panel, in the order that the server wrote them. */
function readPanelDeclarations(html: string) {
  const style = /style="([^"]*)"/.exec(readPanelTag(html))?.[1] ?? '';
  return style
    .split(';')
    .filter((declaration) => declaration.trim() !== '')
    .map((declaration) => {
      const separator = declaration.indexOf(':');
      return [
        declaration.slice(0, separator).trim(),
        declaration.slice(separator + 1).trim(),
      ] as const;
    });
}

describe('<Collapsible.Panel />', () => {
  describe('server-side rendering', () => {
    it('suppresses the initial keyframe animation when rendered open', async () => {
      const html = await renderToString(
        <>
          <style>{`
            @keyframes panel-slide-down {
              from {
                height: 0;
              }

              to {
                height: var(--collapsible-panel-height);
              }
            }

            .animation-test-panel[data-open] {
              animation: panel-slide-down 100ms linear;
            }
          `}</style>

          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel class="animation-test-panel" data-testid="panel">
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        </>,
      );

      expect(readPanelDeclarations(html)).toContainEqual(['animation-name', 'none']);
    });

    it('suppresses the initial keyframe animation from inline styles when rendered open', async () => {
      const html = await renderToString(
        <>
          <style>{`
            @keyframes panel-slide-down {
              from {
                height: 0;
              }

              to {
                height: var(--collapsible-panel-height);
              }
            }
          `}</style>

          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel
              data-testid="panel"
              style={{
                animationDuration: '100ms',
                animationName: 'panel-slide-down',
                animationTimingFunction: 'linear',
              }}
            >
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        </>,
      );

      const animationNames = readPanelDeclarations(html).filter(
        ([property]) => property === 'animation-name',
      );
      expect(animationNames.at(-1)).toEqual(['animation-name', 'none']);
      expect(readPanelDeclarations(html)).toContainEqual(['animation-duration', '100ms']);
    });
  });

  describe('server HTML', () => {
    it('has data-open, the id that aria-controls names and no hidden on an open panel', async () => {
      const html = await renderToString(
        <Collapsible.Root defaultOpen>
          <Collapsible.Trigger>Trigger</Collapsible.Trigger>
          <Collapsible.Panel data-testid="panel">{PANEL_CONTENT}</Collapsible.Panel>
        </Collapsible.Root>,
      );

      const panelTag = readPanelTag(html);
      const panelId = /\sid="([^"]+)"/.exec(panelTag)?.[1];

      expect(panelTag).toContain(' data-open');
      expect(panelTag).not.toMatch(/\shidden/);
      expect(panelId).toMatch(/^vase-ui-./);
      expect(html).toContain(`aria-controls="${panelId}"`);
    });

    // The server writes the trigger before the `setup` of the panel runs, so the trigger cannot
    // name the `id` prop of the panel.
    it('names the generated id in aria-controls of an open trigger whose panel has an id', async () => {
      const html = await renderToString(
        <Collapsible.Root defaultOpen>
          <Collapsible.Trigger>Trigger</Collapsible.Trigger>
          <Collapsible.Panel id="custom-panel-id" data-testid="panel">
            {PANEL_CONTENT}
          </Collapsible.Panel>
        </Collapsible.Root>,
      );

      const triggerTag = readTriggerTag(html);

      expect(triggerTag).toMatch(/\saria-controls="[^"]+"/);
      expect(triggerTag).not.toContain('aria-controls="custom-panel-id"');
      expect(readPanelTag(html)).toContain(' id="custom-panel-id"');
    });

    it('has no panel when it is closed and has no keepMounted', async () => {
      const html = await renderToString(
        <Collapsible.Root>
          <Collapsible.Trigger>Trigger</Collapsible.Trigger>
          <Collapsible.Panel data-testid="panel">{PANEL_CONTENT}</Collapsible.Panel>
        </Collapsible.Root>,
      );

      expect(html).not.toContain('data-testid="panel"');
      expect(html).not.toContain(PANEL_CONTENT);
      expect(html).not.toContain('aria-controls');
    });

    it('has hidden and data-closed on a closed panel with keepMounted', async () => {
      const html = await renderToString(
        <Collapsible.Root>
          <Collapsible.Trigger>Trigger</Collapsible.Trigger>
          <Collapsible.Panel keepMounted data-testid="panel">
            {PANEL_CONTENT}
          </Collapsible.Panel>
        </Collapsible.Root>,
      );

      const panelTag = readPanelTag(html);

      expect(panelTag).toMatch(/\shidden(?=[\s>])/);
      expect(panelTag).toContain(' data-closed');
    });
  });

  describe('VUE-3: the server HTML of a closed panel with hiddenUntilFound', () => {
    it.runIf(canWriteUntilFound)('has hidden="until-found"', async () => {
      const html = await renderToString(
        <Collapsible.Root>
          <Collapsible.Trigger>Trigger</Collapsible.Trigger>
          <Collapsible.Panel hiddenUntilFound data-testid="panel">
            {PANEL_CONTENT}
          </Collapsible.Panel>
        </Collapsible.Root>,
      );

      expect(readPanelTag(html)).toContain(' hidden="until-found"');
    });

    it.runIf(!canWriteUntilFound)(
      'has a bare hidden, because a server before Vue 3.5.41 cannot write the value',
      async () => {
        const html = await renderToString(
          <Collapsible.Root>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel hiddenUntilFound data-testid="panel">
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>,
        );

        const panelTag = readPanelTag(html);

        expect(panelTag).toMatch(/\shidden(?=[\s>])/);
        expect(panelTag).not.toContain('until-found');
      },
    );
  });
});
