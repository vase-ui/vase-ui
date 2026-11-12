import { expect, describe, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { useMediaQuery } from '@vase-ui/vue/unstable-use-media-query';

function createMatchMedia(initialMatches: boolean) {
  const listeners = new Set<() => void>();
  const mediaQueryList = {
    matches: initialMatches,
    addEventListener: vi.fn((_type: string, listener: () => void) => {
      listeners.add(listener);
    }),
  };
  const matchMedia = vi.fn(() => mediaQueryList) as unknown as typeof window.matchMedia;

  return { matchMedia, listeners };
}

describe('useMediaQuery', () => {
  const Test = defineComponent(
    (props: { query: string; options: useMediaQuery.Options }) => {
      const matches = useMediaQuery(
        () => props.query,
        () => props.options,
      );
      return () => <span data-testid="result">{String(matches.value)}</span>;
    },
    { props: ['query', 'options'] },
  );

  it('uses ssrMatchMedia for the server snapshot', async () => {
    const ssrMatchMedia = vi.fn(() => ({ matches: true }));

    const html = await renderToString(
      <Test query="(min-width: 600px)" options={{ ssrMatchMedia }} />,
    );

    expect(ssrMatchMedia).toHaveBeenCalledWith('(min-width: 600px)');
    expect(html).toBe('<span data-testid="result">true</span>');
  });

  it('uses the client matchMedia result as the server snapshot when noSsr is set', async () => {
    const media = createMatchMedia(true);

    const withNoSsr = await renderToString(
      <Test
        query="(min-width: 600px)"
        options={{ matchMedia: media.matchMedia, defaultMatches: false, noSsr: true }}
      />,
    );

    expect(withNoSsr).toBe('<span data-testid="result">true</span>');
    expect(media.listeners.size).toBe(0);

    const withoutNoSsr = await renderToString(
      <Test
        query="(min-width: 600px)"
        options={{ matchMedia: media.matchMedia, defaultMatches: false }}
      />,
    );

    expect(withoutNoSsr).toBe('<span data-testid="result">false</span>');
  });
});
