import { expect, vi, describe, it, onTestFinished } from 'vitest';
import { createSSRApp, h } from 'vue';
import type { Component } from 'vue';
import { Slider } from '@vase-ui/vue/slider';
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
import SliderValueHydration from './SliderValueHydration.test.vue';

describe('<Slider.Value />', () => {
  const { render } = createRenderer();

  describeConformance(<Slider.Value />, () => ({
    render: (node) => {
      return render(<Slider.Root>{node}</Slider.Root>);
    },
    refInstanceof: window.HTMLOutputElement,
  }));

  it('renders a single value', async () => {
    await render(
      <Slider.Root defaultValue={40}>
        <Slider.Value data-testid="output" />
      </Slider.Root>,
    );

    const sliderValue = screen.getByTestId('output');

    expect(sliderValue).toHaveTextContent('40');
  });

  it('renders a range', async () => {
    await render(
      <Slider.Root defaultValue={[40, 65]}>
        <Slider.Value data-testid="output" />
      </Slider.Root>,
    );

    const sliderValue = screen.getByTestId('output');

    expect(sliderValue).toHaveTextContent('40 – 65');
  });

  it('associates the output with every thumb input', async () => {
    await render(
      <Slider.Root defaultValue={[40, 65]}>
        <Slider.Value data-testid="output" />
        <Slider.Control>
          <Slider.Thumb index={0} />
          <Slider.Thumb index={1} />
        </Slider.Control>
      </Slider.Root>,
    );

    const thumbIds = screen.getAllByRole('slider').map((thumb) => thumb.id);

    expect(thumbIds).not.toContain('');
    expect(new Set(thumbIds).size).toBe(thumbIds.length);
    expect(screen.getByTestId('output')).toHaveAttribute('for', thumbIds.join(' '));
  });

  it('renders all thumb values', async () => {
    await render(
      <Slider.Root defaultValue={[40, 60, 80, 95]}>
        <Slider.Value data-testid="output" />
      </Slider.Root>,
    );

    const sliderValue = screen.getByTestId('output');

    expect(sliderValue).toHaveTextContent('40 – 60 – 80 – 95');
  });

  it('recomputes the formatted output when the format option changes', async () => {
    function formatValue(v: number, format?: Intl.NumberFormatOptions) {
      return new Intl.NumberFormat(undefined, format).format(v);
    }

    const { setProps } = await render(
      <Slider.Root defaultValue={40}>
        <Slider.Value data-testid="output" />
      </Slider.Root>,
    );

    expect(screen.getByTestId('output').textContent).toBe(formatValue(40));

    await setProps({ format: { style: 'currency', currency: 'USD' } });

    expect(screen.getByTestId('output').textContent).toBe(
      formatValue(40, { style: 'currency', currency: 'USD' }),
    );
  });

  it('renders the formatted values in the children component of the #render slot', async () => {
    await render(
      <Slider.Root defaultValue={[40, 65]}>
        <Slider.Value
          data-testid="output"
          v-slots={{
            render: ({ props, children }: { props: HTMLProps; children: Component }) => (
              <strong {...props}>{h(children)}</strong>
            ),
          }}
        />
      </Slider.Root>,
    );

    const output = screen.getByTestId('output');
    expect(output.localName).toBe('strong');
    expect(output.textContent).toBe('40 – 65');
  });

  it('renders no text node when the slider has no value', async () => {
    await render(
      <Slider.Root defaultValue={[]}>
        <Slider.Value data-testid="output" />
      </Slider.Root>,
    );

    expect(screen.getByTestId('output')).toBeEmptyDOMElement();
  });

  describe('prop: children', () => {
    it('accepts a render function', async () => {
      const format: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: 'USD',
      };
      function formatValue(v: number) {
        return new Intl.NumberFormat(undefined, format).format(v);
      }
      const renderSpy = vi.fn(
        (_content: { formattedValues: readonly string[]; values: readonly number[] }) => 'text',
      );
      await render(
        <Slider.Root defaultValue={[40, 60]} format={format}>
          <Slider.Value data-testid="output" v-slots={{ default: renderSpy }} />
        </Slider.Root>,
      );

      expect(renderSpy.mock.lastCall?.[0].formattedValues).toEqual([
        formatValue(40),
        formatValue(60),
      ]);
      expect(renderSpy.mock.lastCall?.[0].values).toEqual([40, 60]);
    });
  });

  describe('server-side rendering', () => {
    async function expectHydratesWithRuntimeLocale(suspense: boolean) {
      // Options no other test here formats with; see `mockRuntimeLocale`.
      const format = { maximumFractionDigits: 1 };
      const props = { defaultValue: 1000, max: 2000, format, suspense };
      mockRuntimeLocale('de-DE');

      // The `hydrate` helper waits two ticks. A value in `<Suspense>` hydrates later than that, so
      // the test hydrates by hand and waits for the text.
      const serverHtml = await renderOnServer(
        'src/slider/value/SliderValueHydration.test.vue',
        props,
      );
      const container = document.createElement('div');
      document.body.append(container);
      container.innerHTML = serverHtml;
      const value = within(container).getByTestId('output');
      expect(value.textContent).toBe((1000).toLocaleString('en-US', format));

      const app = createSSRApp(SliderValueHydration, props);
      onTestFinished(() => {
        app.unmount();
        container.remove();
      });
      app.mount(container);

      await waitFor(() => {
        expect(value.textContent).toBe((1000).toLocaleString('de-DE', format));
      });
      // A mismatch makes Vue discard the server nodes and render new nodes.
      expect(within(container).getByTestId('output')).toBe(value);
      expect(takeReportedMessages()).toEqual([]);
    }

    it('hydrates directly inside Root without a mismatch, then uses the runtime locale', () =>
      expectHydratesWithRuntimeLocale(false));

    it('hydrates inside a Suspense boundary without a mismatch, then uses the runtime locale', () =>
      expectHydratesWithRuntimeLocale(true));
  });
});
