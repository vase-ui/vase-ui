import { expect, vi, describe, it, onTestFinished } from 'vitest';
import { createSSRApp, h } from 'vue';
import type { Component } from 'vue';
import { Meter } from '@vase-ui/vue/meter';
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
import MeterValueHydration from './MeterValueHydration.test.vue';

describe('<Meter.Value />', () => {
  const { render } = createRenderer();

  describeConformance(<Meter.Value />, () => ({
    render: (node) => {
      return render(<Meter.Root value={30}>{node}</Meter.Root>);
    },
    refInstanceof: window.HTMLSpanElement,
  }));

  it('renders the formatted value in the children component of the #render slot', async () => {
    const format: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: 'USD',
    };

    await render(
      <Meter.Root value={30} format={format}>
        <Meter.Value
          data-testid="value"
          v-slots={{
            render: ({ props, children }: { props: HTMLProps; children: Component }) => (
              <strong {...props}>{h(children)}</strong>
            ),
          }}
        />
      </Meter.Root>,
    );

    const value = screen.getByTestId('value');
    expect(value.localName).toBe('strong');
    expect(value.textContent).toBe(new Intl.NumberFormat(undefined, format).format(30));
  });

  describe('prop: children', () => {
    it('renders the value when children is not provided', async () => {
      await render(
        <Meter.Root value={30}>
          <Meter.Value data-testid="value" />
        </Meter.Root>,
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
        <Meter.Root value={30} format={format}>
          <Meter.Value data-testid="value" />
        </Meter.Root>,
      );

      const value = screen.getByTestId('value');
      expect(value.textContent).toBe(formatValue(30));
    });

    it('accepts a render function', async () => {
      const renderSpy = vi.fn((_content: { formattedValue: string; value: number }) => 'text');
      const format: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: 'USD',
      };
      function formatValue(v: number) {
        return new Intl.NumberFormat(undefined, format).format(v);
      }
      await render(
        <Meter.Root value={30} format={format}>
          <Meter.Value data-testid="value" v-slots={{ default: renderSpy }} />
        </Meter.Root>,
      );
      expect(renderSpy.mock.lastCall?.[0].formattedValue).toEqual(formatValue(30));
      expect(renderSpy.mock.lastCall?.[0].value).toEqual(30);
    });

    it('passes updated arguments to the render function when value changes', async () => {
      const renderSpy = vi.fn((_content: { formattedValue: string; value: number }) => 'text');

      const { setProps } = await render(
        <Meter.Root value={30}>
          <Meter.Value v-slots={{ default: renderSpy }} />
        </Meter.Root>,
      );

      expect(renderSpy.mock.lastCall?.[0].formattedValue).toEqual(
        (0.3).toLocaleString(undefined, { style: 'percent' }),
      );
      expect(renderSpy.mock.lastCall?.[0].value).toEqual(30);

      await setProps({ value: 60 });

      expect(renderSpy.mock.lastCall?.[0].formattedValue).toEqual(
        (0.6).toLocaleString(undefined, { style: 'percent' }),
      );
      expect(renderSpy.mock.lastCall?.[0].value).toEqual(60);
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
        'src/meter/value/MeterValueHydration.test.vue',
        props,
      );
      const container = document.createElement('div');
      document.body.append(container);
      container.innerHTML = serverHtml;
      const value = within(container).getByTestId('value');
      expect(value.textContent).toBe((1234.5).toLocaleString('en-US', format));

      const app = createSSRApp(MeterValueHydration, props);
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
