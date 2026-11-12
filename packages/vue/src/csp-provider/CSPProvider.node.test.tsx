import { describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { useCSPContext } from '../internals/csp-context/CSPContext';
import CSPProvider from './CSPProvider.vue';

describe('<CSPProvider /> on a server', () => {
  const Probe = defineComponent(() => {
    const csp = useCSPContext();
    return () => (
      <div
        data-nonce={csp.value.nonce}
        data-disable-style-elements={String(csp.value.disableStyleElements)}
      />
    );
  });

  it('renders on a server', async () => {
    const html = await renderToString(
      <CSPProvider nonce="test-nonce">
        <Probe />
      </CSPProvider>,
    );

    expect(html).toBe(
      '<!--[--><div data-nonce="test-nonce" data-disable-style-elements="false"></div><!--]-->',
    );
  });
});
