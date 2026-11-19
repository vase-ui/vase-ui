import { expect, describe, it } from 'vitest';
import { defineComponent, normalizeStyle } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { Accordion } from '@vase-ui/vue/accordion';

const PANEL_CONTENT = 'This is panel content';

/** The start tag of the panel, which has `data-testid="panel"`. */
function readPanelTag(html: string) {
  const tag = /<div[^>]*data-testid="panel"[^>]*>/.exec(html)?.[0];
  if (tag === undefined) {
    throw new Error(`The HTML has no panel:\n${html}`);
  }
  return tag;
}

function readPanelStyle(html: string) {
  const style = /style="([^"]*)"/.exec(readPanelTag(html))?.[1] ?? '';
  return normalizeStyle([style]) as Record<string, string>;
}

describe('<Accordion.Panel />', () => {
  describe('server-side rendering', () => {
    it('suppresses the initial keyframe animation from inline styles when rendered open', async () => {
      const html = await renderToString(
        <>
          <style>{`
            @keyframes panel-slide-down {
              from {
                height: 0;
              }

              to {
                height: var(--accordion-panel-height);
              }
            }
          `}</style>

          <Accordion.Root defaultValue={[0]}>
            <Accordion.Item value={0}>
              <Accordion.Header>
                <Accordion.Trigger>Trigger</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel
                data-testid="panel"
                style={{
                  animationDuration: '100ms',
                  animationName: 'panel-slide-down',
                  animationTimingFunction: 'linear',
                }}
              >
                {PANEL_CONTENT}
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion.Root>
        </>,
      );

      const style = readPanelStyle(html);
      expect(style['animation-name']).toBe('none');
      expect(style['animation-duration']).toBe('100ms');
    });
  });

  describe('VUE-80: the server HTML of a panel names only a trigger that exists', () => {
    // The trigger registers its id after the server wrote the panel.
    it('has no aria-labelledby when the trigger comes after the panel below an async setup', async () => {
      const HeaderAfterAsyncSetup = defineComponent({
        async setup() {
          await Promise.resolve();
          return () => (
            <Accordion.Header>
              <Accordion.Trigger id="custom-trigger-id">Trigger</Accordion.Trigger>
            </Accordion.Header>
          );
        },
      });

      const html = await renderToString(
        <Accordion.Root defaultValue={[0]}>
          <Accordion.Item value={0}>
            <Accordion.Panel data-testid="panel">{PANEL_CONTENT}</Accordion.Panel>
            <HeaderAfterAsyncSetup />
          </Accordion.Item>
        </Accordion.Root>,
      );

      expect(readPanelTag(html)).toContain(' data-open');
      expect(html).toContain(' id="custom-trigger-id"');
      expect(html).not.toContain('aria-labelledby');
    });
  });
});
