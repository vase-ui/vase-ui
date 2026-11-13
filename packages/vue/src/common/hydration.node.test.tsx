import { expect, describe, it } from 'vitest';
import { defineComponent } from 'vue';
import type { Ref } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { useIsHydrated, useIsHydrating } from './hydration';

function createProbe(hook: () => Readonly<Ref<boolean>>, testId: string) {
  return defineComponent(() => {
    const value = hook();
    return () => <span data-testid={testId}>{value.value ? 'yes' : 'no'}</span>;
  });
}

describe('hydration', () => {
  describe('useIsHydrated', () => {
    const Probe = createProbe(useIsHydrated, 'hydrated');

    it('does not report hydrated while rendering on the server', async () => {
      const html = await renderToString(<Probe />);

      expect(html).toBe('<span data-testid="hydrated">no</span>');
    });
  });

  describe('useIsHydrating', () => {
    const Probe = createProbe(useIsHydrating, 'hydrating');

    it('reports hydrating while rendering on the server', async () => {
      const html = await renderToString(<Probe />);

      expect(html).toBe('<span data-testid="hydrating">yes</span>');
    });
  });
});
