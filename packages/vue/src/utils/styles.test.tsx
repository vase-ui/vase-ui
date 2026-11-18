import { describe, expect, it, onTestFinished } from 'vitest';
import { nextTick, shallowRef } from 'vue';
import { CSPProvider } from '@vase-ui/vue/csp-provider';
import { createRenderer } from '#test-utils';
import { TestElement } from '../../test/testElement';
import { styleDisableScrollbar, useStyleDisableScrollbar } from './styles';

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
