import { expect, describe, it } from 'vitest';
import { defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { Accordion } from '@vase-ui/vue/accordion';

const PANEL_CONTENT = 'This is panel content';

/** The declarations of the `style` attribute of the panel, in the order that the server wrote them. */
function readPanelDeclarations(html: string) {
  const tag = /<div[^>]*data-testid="panel"[^>]*>/.exec(html)?.[0];
  if (tag === undefined) {
    throw new Error(`The HTML has no panel:\n${html}`);
  }
  const style = /style="([^"]*)"/.exec(tag)?.[1] ?? '';
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

      const animationNames = readPanelDeclarations(html).filter(
        ([property]) => property === 'animation-name',
      );
      expect(animationNames.at(-1)).toEqual(['animation-name', 'none']);
      expect(readPanelDeclarations(html)).toContainEqual(['animation-duration', '100ms']);
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

      expect(html).toContain(' id="custom-trigger-id"');
      expect(html).not.toContain('aria-labelledby');
    });
  });
});
