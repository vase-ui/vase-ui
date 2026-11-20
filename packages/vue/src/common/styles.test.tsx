import { describe, expect, it, onTestFinished } from 'vitest';
import { createApp, nextTick, shallowRef, Teleport } from 'vue';
import { CSPProvider } from '@vase-ui/vue/csp-provider';
import { ScrollArea } from '@vase-ui/vue/scroll-area';
import { createRenderer, flushMicrotasks, installPartsInterop, nextEvent } from '#test-utils';
import { TestElement } from '../../test/testElement';
import { styleDisableScrollbar, useStyleDisableScrollbar } from './styles';

function queryDisableScrollbarStyles(root: ParentNode) {
  return Array.from(root.querySelectorAll('style')).filter((element) =>
    element.textContent?.includes('.vase-ui-disable-scrollbar'),
  );
}

describe('useStyleDisableScrollbar', () => {
  const { render } = createRenderer();

  it('keeps the style across targets in one root and moves it with the active target', async () => {
    const host = document.createElement('div');
    const destination = document.createElement('div');
    document.body.append(host, destination);
    onTestFinished(() => {
      host.remove();
      destination.remove();
    });
    const root = host.attachShadow({ mode: 'open' });
    const nextRoot = destination.attachShadow({ mode: 'open' });
    const first = document.createElement('div');
    const second = document.createElement('div');
    root.append(first, second);
    const target = shallowRef(first);
    const setupElement = () => {
      useStyleDisableScrollbar(target);
    };
    const nonce = shallowRef('first');
    const { unmount } = await render(() => (
      <CSPProvider nonce={nonce.value}>
        <TestElement setupElement={setupElement} />
      </CSPProvider>
    ));
    const style = root.querySelector('style');
    expect(style?.textContent).toBe(styleDisableScrollbar.css);
    expect(style?.nonce).toBe('first');

    nonce.value = 'second';
    target.value = second;
    await nextTick();
    expect(root.querySelector('style')).toBe(style);
    expect(style?.nonce).toBe('first');

    const moved = new Promise<string | undefined>((resolve) => {
      const observer = new MutationObserver(() => {
        observer.disconnect();
        resolve(nextRoot.querySelector('style')?.textContent);
      });
      observer.observe(root, { childList: true });
      onTestFinished(() => observer.disconnect());
    });
    nextRoot.append(second);
    expect(await moved).toBe(styleDisableScrollbar.css);
    expect(nextRoot.querySelector('style')?.nonce).toBe('second');
    expect(root.querySelector('style')).toBeNull();
    unmount();
    expect(nextRoot.querySelector('style')).toBeNull();
  });
});

describe('the style element of ScrollArea.Root', () => {
  const { render } = createRenderer();

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
    const app = installPartsInterop(createApp({ render: () => <ScrollArea.Root /> }));
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

  it('moves the style element when `Teleport` moves the root into a shadow root and back', async () => {
    const host = document.createElement('div');
    const container = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    shadowRoot.append(container);
    document.body.append(host);
    onTestFinished(() => host.remove());
    const moved = shallowRef(false);
    await render(() => (
      <Teleport to={container} disabled={!moved.value}>
        <ScrollArea.Root />
      </Teleport>
    ));
    expect(queryDisableScrollbarStyles(document)).toHaveLength(1);
    expect(queryDisableScrollbarStyles(shadowRoot)).toHaveLength(0);

    moved.value = true;
    await flushMicrotasks();
    expect(queryDisableScrollbarStyles(shadowRoot)).toHaveLength(1);
    expect(queryDisableScrollbarStyles(document)).toHaveLength(0);

    moved.value = false;
    await flushMicrotasks();
    expect(queryDisableScrollbarStyles(document)).toHaveLength(1);
    expect(queryDisableScrollbarStyles(shadowRoot)).toHaveLength(0);
  });

  it('adds the style element only after the consumer attaches the tree to the document', async () => {
    const container = document.createElement('div');
    onTestFinished(() => container.remove());
    await render(
      <Teleport to={container}>
        <ScrollArea.Root />
      </Teleport>,
    );
    expect(queryDisableScrollbarStyles(document)).toHaveLength(0);
    expect(queryDisableScrollbarStyles(container)).toHaveLength(0);

    document.body.append(container);
    await flushMicrotasks();

    expect(queryDisableScrollbarStyles(document.head)).toHaveLength(1);
    expect(queryDisableScrollbarStyles(container)).toHaveLength(0);
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
    const violations: (EventTarget | null)[] = [];
    // `nextEvent` resolves in a listener of the control, and the case continues before the event
    // bubbles. A capture listener of the document gets the event before that listener.
    frameDocument.addEventListener(
      'securitypolicyviolation',
      (event) => {
        violations.push(event.target);
      },
      { capture: true },
    );
    const container = frameDocument.createElement('div');
    frameDocument.body.append(container);
    const app = installPartsInterop(
      createApp({
        render: () => (
          <CSPProvider nonce="test-nonce">
            <ScrollArea.Root />
          </CSPProvider>
        ),
      }),
    );
    onTestFinished(() => {
      app.unmount();
    });

    app.mount(container);
    // The flush after the mount removes the style element of the first render.
    await nextTick();

    // A style element with no nonce gets no style sheet when the policy is in force. The browser
    // sends the violation events in a later task, in the order of the violations. The event of
    // this element thus comes after the event of each element that connected before it.
    const control = frameDocument.createElement('style');
    control.textContent = 'body{margin:0}';
    await nextEvent(control, 'securitypolicyviolation', {
      action: () => frameDocument.head.append(control),
    });

    expect(control.sheet).toBeNull();
    const styles = queryDisableScrollbarStyles(frameDocument);
    expect(styles).toHaveLength(1);
    expect(styles[0].parentElement).toBe(frameDocument.head);
    expect(styles[0].sheet).not.toBeNull();
    expect(violations).toHaveLength(1);
    expect(violations.at(0)).toBe(control);
  });

  it('writes the nonce attribute on the style element of the first client render', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const app = installPartsInterop(
      createApp({
        render: () => (
          <CSPProvider nonce="test-nonce">
            <ScrollArea.Root />
          </CSPProvider>
        ),
      }),
    );
    onTestFinished(() => {
      app.unmount();
      container.remove();
    });

    app.mount(container);

    // The flush that removes this element comes after the mount.
    expect(container.querySelector('style')).toHaveAttribute('nonce', 'test-nonce');
  });
});
