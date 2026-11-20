import type { Ref } from 'vue';
import { expect, describe, it } from 'vitest';
import { defineComponent } from 'vue';
import { createRenderer, screen } from '#test-utils';
import { useIsHydrated, useIsHydrating } from './hydration';

function createProbe(hook: () => Readonly<Ref<boolean>>, testId: string) {
  return defineComponent(() => {
    const value = hook();
    return () => <span data-testid={testId}>{value.value ? 'yes' : 'no'}</span>;
  });
}

describe('hydration', () => {
  const { render } = createRenderer();

  describe('useIsHydrated', () => {
    const Probe = createProbe(useIsHydrated, 'hydrated');

    it('reports hydrated once mounted on the client', async () => {
      await render(<Probe />);

      expect(screen.getByTestId('hydrated')).toHaveTextContent('yes');
    });
  });

  describe('useIsHydrating', () => {
    const Probe = createProbe(useIsHydrating, 'hydrating');

    it('does not report hydrating for a client-only mount', async () => {
      await render(<Probe />);

      expect(screen.getByTestId('hydrating')).toHaveTextContent('no');
    });
  });
});
