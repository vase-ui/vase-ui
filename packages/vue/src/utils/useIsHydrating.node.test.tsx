import { expect, describe, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import UseIsHydratingProbe from './UseIsHydratingProbe.test.vue';

describe('useIsHydrating', () => {
  it('returns true before hydration for server-rendered markup', async () => {
    const html = await renderToString(<UseIsHydratingProbe />);

    expect(html).toBe('<span data-testid="value">true</span>');
  });
});
