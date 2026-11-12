import { expect, vi, describe, it, onTestFinished } from 'vitest';
import { createSSRApp, h } from 'vue';
import type { Component } from 'vue';
import { Progress } from '@vase-ui/vue/progress';
import type { HTMLProps } from '@vase-ui/vue/types';
import {
  createRenderer,
  describeConformance,
  mockRuntimeLocale,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
  within,
} from '#test-utils';
import ProgressValueHydration from './ProgressValueHydration.test.vue';

describe('<Progress.Value />', () => {
  const { render } = createRenderer();

  describeConformance(<Progress.Value />, () => ({
    render: (node) => {
      return render(<Progress.Root value={40}>{node}</Progress.Root>);
    },
    refInstanceof: window.HTMLSpanElement,
  }));

  it('renders the formatted value in the children component of the #render slot', async () => {
    const format: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: 'USD',
    };

    await render(
      <Progress.Root value={30} format={format}>
        <Progress.Value
          data-testid="value"
          v-slots={{
            render: ({ props, children }: { props: HTMLProps; children: Component }) => (
              <strong {...props}>{h(children)}</strong>
            ),
          }}
        />
      </Progress.Root>,
    );

    const value = screen.getByTestId('value');
    expect(value.localName).toBe('strong');
    expect(value.textContent).toBe(new Intl.NumberFormat(undefined, format).format(30));
  });

  describe('prop: children', () => {
    it('renders the value when children is not provided', async () => {
      await render(
        <Progress.Root value={30}>
          <Progress.Value data-testid="value" />
        </Progress.Root>,
      );

      const value = screen.getByTestId('value');
      expect(value.textContent).toBe((0.3).toLocaleString(undefined, { style: 'percent' }));
    });

    it('renders a formatted value when a format is provided', async () => {
      const format: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: 'USD',
      };
      function formatValue(v: number) {
        return new Intl.NumberFormat(undefined, format).format(v);
      }

      await render(
        <Progress.Root value={30} format={format}>
          <Progress.Value data-testid="value" />
        </Progress.Root>,
      );

      const value = screen.getByTestId('value');
      expect(value.textContent).toBe(formatValue(30));
    });

    describe('it accepts a render function', () => {
      it('numerical value', async () => {
        const renderSpy = vi.fn(
          (_content: { formattedValue: string | null; value: number | null }) => 'text',
        );
        const format: Intl.NumberFormatOptions = {
          style: 'currency',
          currency: 'USD',
        };
        function formatValue(v: number) {
          return new Intl.NumberFormat(undefined, format).format(v);
        }
        await render(
          <Progress.Root value={30} format={format}>
            <Progress.Value data-testid="value" v-slots={{ default: renderSpy }} />
          </Progress.Root>,
        );
        expect(renderSpy.mock.lastCall?.[0].formattedValue).toEqual(formatValue(30));
        expect(renderSpy.mock.lastCall?.[0].value).toEqual(30);
      });

      it.each([null, Number.NaN])('indeterminate value %s', async (value) => {
        const renderSpy = vi.fn(
          (_content: { formattedValue: string | null; value: number | null }) => 'text',
        );
        const format: Intl.NumberFormatOptions = {
          style: 'currency',
          currency: 'USD',
        };
        await render(
          <Progress.Root value={value} format={format}>
            <Progress.Value data-testid="value" v-slots={{ default: renderSpy }} />
          </Progress.Root>,
        );
        expect(renderSpy.mock.lastCall?.[0].formattedValue).toEqual('indeterminate');
        expect(renderSpy.mock.lastCall?.[0].value).toEqual(value);
      });
    });
  });

  describe('server-side rendering', () => {
    it.each([
      { name: 'directly inside Root', suspense: false },
      { name: 'inside a Suspense boundary', suspense: true },
    ])('hydrates $name without a mismatch, then uses the runtime locale', async ({ suspense }) => {
      // Options no other test here formats with; see `mockRuntimeLocale`.
      const format = { maximumFractionDigits: 1 };
      const props = { value: 1234.5, max: 2000, format, suspense };
      mockRuntimeLocale('de-DE');

      // The `hydrate` helper waits two ticks. A value in `<Suspense>` hydrates later than that, so
      // the test hydrates by hand and waits for the text.
      const serverHtml = await renderOnServer(
        'src/progress/value/ProgressValueHydration.test.vue',
        props,
      );
      const container = document.createElement('div');
      document.body.append(container);
      container.innerHTML = serverHtml;
      const value = within(container).getByTestId('value');
      expect(value.textContent).toBe((1234.5).toLocaleString('en-US', format));

      const app = createSSRApp(ProgressValueHydration, props);
      onTestFinished(() => {
        app.unmount();
        container.remove();
      });
      app.mount(container);

      await waitFor(() => {
        expect(value.textContent).toBe((1234.5).toLocaleString('de-DE', format));
      });
      // A mismatch makes Vue discard the server nodes and render new nodes.
      expect(within(container).getByTestId('value')).toBe(value);
      expect(takeReportedMessages()).toEqual([]);
    });
  });
});
