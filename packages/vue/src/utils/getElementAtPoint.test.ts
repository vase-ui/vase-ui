import { afterEach, describe, expect, it } from 'vitest';
import { getElementAtPoint } from './getElementAtPoint';

describe('getElementAtPoint', () => {
  let host: HTMLElement | null = null;

  afterEach(() => {
    host?.remove();
    host = null;
  });

  function mountShadowHost() {
    host = document.createElement('div');
    host.style.cssText = 'position: fixed; left: 0; top: 0; width: 100px; height: 100px';
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('div');
    inner.style.cssText = 'width: 100px; height: 100px';
    shadowRoot.append(inner);
    document.body.append(host);
    return { host, shadowRoot, inner };
  }

  it('gives the element inside a shadow root when the root is that shadow root', () => {
    const { shadowRoot, inner, host: shadowHost } = mountShadowHost();

    expect(getElementAtPoint(shadowRoot, 50, 50)).toBe(inner);
    expect(getElementAtPoint(document, 50, 50)).toBe(shadowHost);
  });

  it('gives null for a root that has no elementFromPoint', () => {
    const detached = document.createElement('div');

    expect(getElementAtPoint(detached, 50, 50)).toBe(null);
    expect(getElementAtPoint(null, 50, 50)).toBe(null);
    expect(getElementAtPoint(undefined, 50, 50)).toBe(null);
  });
});
