import { expect, describe, it, vi } from 'vitest';
import { defineComponent, onMounted, shallowRef } from 'vue';
import { useMediaQuery } from '@vase-ui/vue/unstable-use-media-query';
import {
  createRenderer,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  within,
} from '#test-utils';
import UseMediaQueryProbe from './UseMediaQueryProbe.test.vue';

function createMatchMedia(initialMatches: boolean) {
  const listeners = new Set<() => void>();
  const mediaQueryList = {
    matches: initialMatches,
    addEventListener: vi.fn((_type: string, listener: () => void) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_type: string, listener: () => void) => {
      listeners.delete(listener);
    }),
  };
  const matchMedia = vi.fn(() => mediaQueryList) as unknown as typeof window.matchMedia;

  return {
    matchMedia,
    listeners,
    setMatches(matches: boolean) {
      mediaQueryList.matches = matches;
      listeners.forEach((listener) => listener());
    },
  };
}

describe('useMediaQuery', () => {
  const { render } = createRenderer();

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

  it('returns defaultMatches when matchMedia is unavailable', async () => {
    await render(<Test query="(min-width: 600px)" options={{ matchMedia: null! }} />);

    expect(screen.getByTestId('result')).toHaveTextContent('false');

    await render(
      <Test query="(min-width: 600px)" options={{ matchMedia: null!, defaultMatches: true }} />,
    );

    expect(screen.getAllByTestId('result')[1]).toHaveTextContent('true');
  });

  it('subscribes to the provided matchMedia and updates on change', async () => {
    const media = createMatchMedia(false);

    const { unmount } = await render(
      <Test query="@media (min-width: 600px)" options={{ matchMedia: media.matchMedia }} />,
    );

    expect(media.matchMedia).toHaveBeenCalledWith('(min-width: 600px)');
    expect(screen.getByTestId('result')).toHaveTextContent('false');

    media.setMatches(true);
    await flushMicrotasks();

    expect(screen.getByTestId('result')).toHaveTextContent('true');

    unmount();

    expect(media.listeners.size).toBe(0);
  });

  it.each([
    {
      name: 'the default value, then the real value, without noSsr',
      options: {},
      expected: [false, true],
    },
    { name: 'the real value only, with noSsr', options: { noSsr: true }, expected: [true] },
  ])('renders $name', async ({ options, expected }) => {
    const media = createMatchMedia(true);
    const values: boolean[] = [];

    const Recorder = defineComponent(() => {
      const matches = useMediaQuery('(min-width: 600px)', {
        matchMedia: media.matchMedia,
        defaultMatches: false,
        ...options,
      });

      return () => {
        values.push(matches.value);
        return null;
      };
    });

    await render(<Recorder />);

    expect(values).toEqual(expected);
  });

  it('subscribes again when the query changes', async () => {
    const small = createMatchMedia(false);
    const large = createMatchMedia(true);
    const matchMedia = vi.fn((query: string) =>
      (query === '(min-width: 600px)' ? small : large).matchMedia(query),
    ) as unknown as typeof window.matchMedia;

    const { rerender } = await render(<Test query="(min-width: 600px)" options={{ matchMedia }} />);

    expect(small.listeners.size).toBe(1);
    expect(large.listeners.size).toBe(0);
    expect(screen.getByTestId('result')).toHaveTextContent('false');

    await rerender(<Test query="(min-width: 900px)" options={{ matchMedia }} />);

    expect(small.listeners.size).toBe(0);
    expect(large.listeners.size).toBe(1);
    expect(screen.getByTestId('result')).toHaveTextContent('true');
  });

  it('does not read matchMedia or listen before mount when the query changes before mount', async () => {
    const media = createMatchMedia(true);
    const query = shallowRef('(min-width: 600px)');
    let beforeMount: { reads: number; listeners: number } | undefined;

    const ChangingQuery = defineComponent(() => {
      // This hook is first, so it runs before the hook of the composable.
      onMounted(() => {
        beforeMount = {
          reads: vi.mocked(media.matchMedia).mock.calls.length,
          listeners: media.listeners.size,
        };
      });
      useMediaQuery(query, { matchMedia: media.matchMedia });
      query.value = '(min-width: 900px)';

      return () => null;
    });

    await render(<ChangingQuery />);

    expect(beforeMount).toEqual({ reads: 0, listeners: 0 });
    expect(media.matchMedia).toHaveBeenLastCalledWith('(min-width: 900px)');
    expect(media.listeners.size).toBe(1);
  });

  it('hydrates with the default value, then gives the real value', async () => {
    const props = { query: 'all' };
    const serverHtml = await renderOnServer(
      'src/unstable-use-media-query/UseMediaQueryProbe.test.vue',
      props,
    );
    expect(serverHtml).toBe('<span data-testid="result">false</span>');

    const { container } = await hydrate(UseMediaQueryProbe, { serverHtml, props });

    expect(within(container).getByTestId('result').textContent).toBe('true');
  });
});
