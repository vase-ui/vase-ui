import { describe, expect, it, onTestFinished } from 'vitest';
import { createApp, nextTick } from 'vue';
import { CSPProvider } from '@vase-ui/vue/csp-provider';
import { ScrollArea } from '@vase-ui/vue/scroll-area';
import {
  createRenderer,
  describeConformance,
  hydrate,
  renderOnServer,
  waitSingleFrame,
} from '#test-utils';
import { styleDisableScrollbar } from '../../utils/styles';
import ScrollAreaRootHydration from './ScrollAreaRootHydration.test.vue';

function queryDisableScrollbarStyles(root: ParentNode) {
  return Array.from(root.querySelectorAll('style')).filter((element) =>
    element.textContent?.includes('.vase-ui-disable-scrollbar'),
  );
}

describe('<ScrollArea.Root />', () => {
  const { render } = createRenderer();

  describeConformance(<ScrollArea.Root />, () => ({
    refInstanceof: window.HTMLDivElement,
    render,
  }));

  describe('style element', () => {
    it('keeps one style element for two apps, and removes it with the last app', async () => {
      expect(queryDisableScrollbarStyles(document)).toHaveLength(0);

      const first = await render(
        <CSPProvider nonce="test-nonce">
          <ScrollArea.Root />
        </CSPProvider>,
      );
      const second = await render(
        <CSPProvider nonce="test-nonce">
          <ScrollArea.Root />
        </CSPProvider>,
      );

      const styles = queryDisableScrollbarStyles(document);
      expect(styles).toHaveLength(1);
      expect(document.head.firstElementChild).toBe(styles[0]);
      expect(styles[0]).toHaveAttribute('nonce', 'test-nonce');
      expect(first.container.querySelector('style')).toBeNull();
      expect(second.container.querySelector('style')).toBeNull();

      first.unmount();

      expect(queryDisableScrollbarStyles(document)).toHaveLength(1);

      second.unmount();

      expect(queryDisableScrollbarStyles(document)).toHaveLength(0);
    });

    it('follows disableStyleElements of the provider', async () => {
      const { setProps } = await render(
        <CSPProvider disableStyleElements>
          <ScrollArea.Root />
        </CSPProvider>,
      );

      expect(queryDisableScrollbarStyles(document)).toHaveLength(0);

      await setProps({ disableStyleElements: false });

      expect(queryDisableScrollbarStyles(document)).toHaveLength(1);

      await setProps({ disableStyleElements: true });

      expect(queryDisableScrollbarStyles(document)).toHaveLength(0);
    });

    it('puts the style element in the shadow root of the root, and not in the document', async () => {
      const host = document.createElement('div');
      document.body.append(host);
      const shadowRoot = host.attachShadow({ mode: 'open' });
      const container = document.createElement('div');
      shadowRoot.append(container);
      const app = createApp({ render: () => <ScrollArea.Root /> });
      onTestFinished(() => {
        app.unmount();
        host.remove();
      });

      app.mount(container);
      await nextTick();

      const styles = queryDisableScrollbarStyles(shadowRoot);
      expect(styles).toHaveLength(1);
      expect(shadowRoot.firstElementChild).toBe(styles[0]);
      expect(queryDisableScrollbarStyles(document)).toHaveLength(0);
    });

    it('sets the nonce, so that a policy that needs the nonce accepts the style element', async () => {
      const frame = document.createElement('iframe');
      frame.srcdoc =
        '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="style-src-elem \'nonce-test-nonce\'"></head><body></body></html>';
      const loaded = new Promise((resolve) => {
        frame.addEventListener('load', resolve, { once: true });
      });
      document.body.append(frame);
      onTestFinished(() => {
        frame.remove();
      });
      await loaded;
      const frameDocument = frame.contentDocument!;

      // A style element with no nonce gets no style sheet when the policy is in force.
      const control = frameDocument.createElement('style');
      control.textContent = 'body{margin:0}';
      frameDocument.head.append(control);
      expect(control.sheet).toBeNull();
      // The event of the control comes in a later task. Wait for it, so that the listener below
      // does not count it.
      await waitSingleFrame();
      await waitSingleFrame();

      const violations: Event[] = [];
      frameDocument.addEventListener('securitypolicyviolation', (event) => {
        violations.push(event);
      });
      const container = frameDocument.createElement('div');
      frameDocument.body.append(container);
      const app = createApp({
        render: () => (
          <CSPProvider nonce="test-nonce">
            <ScrollArea.Root />
          </CSPProvider>
        ),
      });
      onTestFinished(() => {
        app.unmount();
      });

      app.mount(container);
      await waitSingleFrame();
      await waitSingleFrame();

      const styles = queryDisableScrollbarStyles(frameDocument);
      expect(styles).toHaveLength(1);
      expect(styles[0].parentElement).toBe(frameDocument.head);
      expect(styles[0].sheet).not.toBeNull();
      expect(violations).toHaveLength(0);
    });

    it('writes the nonce attribute on the style element of the first client render', () => {
      const container = document.createElement('div');
      document.body.append(container);
      const app = createApp({
        render: () => (
          <CSPProvider nonce="test-nonce">
            <ScrollArea.Root />
          </CSPProvider>
        ),
      });
      onTestFinished(() => {
        app.unmount();
        container.remove();
      });

      app.mount(container);

      // The flush that removes this element comes after the mount.
      expect(container.querySelector('style')).toHaveAttribute('nonce', 'test-nonce');
    });
  });

  describe('hydration', () => {
    it.each([
      {
        name: 'a nonce',
        props: { nonce: 'test-nonce' },
        serverStyles: [{ nonce: 'test-nonce', text: styleDisableScrollbar.css }],
        count: 1,
        leaves: 'one shared style element',
      },
      {
        name: 'style elements off',
        props: { disableStyleElements: true },
        serverStyles: [],
        count: 0,
        leaves: 'no style element',
      },
    ])(
      'hydrates a root with $name, then leaves $leaves in the document',
      async ({ props, serverStyles, count }) => {
        const serverHtml = await renderOnServer(
          'src/scroll-area/root/ScrollAreaRootHydration.test.vue',
          props,
        );
        // A `<template>` element parses the HTML with no side effect.
        const template = document.createElement('template');
        template.innerHTML = serverHtml;
        const serverRoot = template.content.querySelector('[data-testid="root"]')!;
        const styles = Array.from(serverRoot.children).filter(
          (child) => child.localName === 'style',
        );
        expect(
          styles.map((style) => ({
            nonce: style.getAttribute('nonce'),
            text: style.textContent,
          })),
        ).toEqual(serverStyles);

        const { container } = await hydrate(ScrollAreaRootHydration, { serverHtml, props });

        expect(container.querySelector('style')).toBeNull();
        expect(queryDisableScrollbarStyles(document)).toHaveLength(count);
      },
    );
  });
});
