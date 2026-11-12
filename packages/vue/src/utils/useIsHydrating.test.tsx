import { expect, describe, it } from 'vitest';
import { createRenderer, hydrate, renderOnServer, screen, within } from '#test-utils';
import UseIsHydratingProbe from './UseIsHydratingProbe.test.vue';

describe('useIsHydrating', () => {
  const { render } = createRenderer();

  it('returns false for client-only mounts', async () => {
    await render(<UseIsHydratingProbe />);

    expect(screen.getByTestId('value')).toHaveTextContent('false');
  });

  it('switches to false after hydration completes', async () => {
    const serverHtml = await renderOnServer('src/utils/UseIsHydratingProbe.test.vue');
    expect(serverHtml).toBe('<span data-testid="value">true</span>');

    const { container } = await hydrate(UseIsHydratingProbe, { serverHtml });

    expect(within(container).getByTestId('value')).toHaveTextContent('false');
  });
});
