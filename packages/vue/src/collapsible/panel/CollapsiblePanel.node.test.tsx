import { expect, describe, it } from 'vitest';
import { defineComponent, h, normalizeStyle } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { Collapsible } from '@vase-ui/vue/collapsible';

const PANEL_CONTENT = 'This is panel content';

// Vue 3.5.41 is the first version whose server writes the value of `hidden`. In Vue 3.6, the
// first such version is 3.6.0-rc.3. An earlier server writes a bare `hidden`.
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

function readPanelStyle(html: string) {
  const style = /style="([^"]*)"/.exec(readPanelTag(html))?.[1] ?? '';
  return normalizeStyle([style]) as Record<string, string>;
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

      expect(readPanelStyle(html)['animation-name']).toBe('none');
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

      const style = readPanelStyle(html);
      expect(style['animation-name']).toBe('none');
      expect(style['animation-duration']).toBe('100ms');
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

  describe('VUE-80: the server HTML of an open trigger names only a panel that exists', () => {
    it('has no aria-controls when the root has no panel', async () => {
      const html = await renderToString(
        <Collapsible.Root defaultOpen>
          <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        </Collapsible.Root>,
      );

      expect(readTriggerTag(html)).toContain(' aria-expanded="true"');
      expect(html).not.toContain('aria-controls');
    });

    // The panel registers its id after the server wrote the trigger.
    it('has no aria-controls when the panel comes after the trigger below an async setup', async () => {
      const PanelAfterAsyncSetup = defineComponent({
        async setup() {
          await Promise.resolve();
          return () => (
            <Collapsible.Panel id="custom-panel-id" data-testid="panel">
              {PANEL_CONTENT}
            </Collapsible.Panel>
          );
        },
      });

      const html = await renderToString(
        <Collapsible.Root defaultOpen>
          <Collapsible.Trigger>Trigger</Collapsible.Trigger>
          <PanelAfterAsyncSetup />
        </Collapsible.Root>,
      );

      expect(readTriggerTag(html)).toContain(' aria-expanded="true"');
      expect(html).not.toContain('aria-controls');
      expect(readPanelTag(html)).toContain(' id="custom-panel-id"');
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
      'has a bare hidden, because a server before Vue 3.5.41, or before 3.6.0-rc.3 in Vue 3.6, cannot write the value',
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
