import { describe, expect, it } from 'vitest';
import { defineComponent, KeepAlive, shallowRef, Teleport } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Slider } from '@vase-ui/vue/slider';
import {
  createRenderer,
  describeConformance,
  expectNoAxeViolations,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  within,
} from '#test-utils';
import SliderLabelHydration from './SliderLabelHydration.test.vue';

describe('<Slider.Label />', () => {
  const { render } = createRenderer();

  describeConformance(<Slider.Label />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Slider.Root defaultValue={50}>
          {node}
          <Slider.Control>
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>,
      );
    },
  }));

  it('focuses the registered thumb when composed within a Field', async () => {
    const { user } = await render(
      <Field.Root>
        <Slider.Root defaultValue={50}>
          <Slider.Label data-testid="label">Volume</Slider.Label>
          <Slider.Control>
            <input aria-label="Unrelated range" type="range" />
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>
      </Field.Root>,
    );

    await user.click(screen.getByTestId('label'));

    expect(screen.getByRole('slider', { name: 'Volume' })).toHaveFocus();
    expect(screen.getByRole('slider', { name: 'Unrelated range' })).not.toHaveFocus();
  });

  it('focuses the thumb in its shadow root when the outer document has a matching ID', async () => {
    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    shadowRoot.appendChild(container);
    document.body.appendChild(host);

    try {
      const { user, unmount } = await render(
        <>
          <input aria-label="Unrelated control" />
          <Teleport to={container}>
            <Field.Root>
              <Slider.Root defaultValue={50}>
                <Slider.Label>Volume</Slider.Label>
                <Slider.Control>
                  <Slider.Thumb />
                </Slider.Control>
              </Slider.Root>
            </Field.Root>
          </Teleport>
        </>,
      );

      try {
        const thumb = within(container).getByRole('slider', { name: 'Volume' });
        const unrelatedControl = screen.getByRole('textbox', { name: 'Unrelated control' });
        expect(thumb.id).not.toBe('');
        unrelatedControl.id = thumb.id;

        await user.click(within(container).getByText('Volume'));

        expect(shadowRoot.activeElement).toBe(thumb);
        expect(unrelatedControl).not.toHaveFocus();
      } finally {
        unmount();
      }
    } finally {
      host.remove();
    }
  });

  it('focuses a thumb in the light DOM from a label in a shadow root', async () => {
    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    shadowRoot.appendChild(container);
    document.body.appendChild(host);

    try {
      const { user, unmount } = await render(
        <Field.Root>
          <Slider.Root defaultValue={50}>
            <Teleport to={container}>
              <Slider.Label>Volume</Slider.Label>
            </Teleport>
            <Slider.Control>
              <input aria-label="Unrelated range" type="range" />
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        </Field.Root>,
      );

      try {
        await user.click(within(container).getByText('Volume'));

        expect(screen.getAllByRole('slider')[1]).toHaveFocus();
      } finally {
        unmount();
      }
    } finally {
      host.remove();
    }
  });

  it('does not throw when the label is clicked in a detached React root', async () => {
    const container = document.createElement('div');

    const { unmount } = await render(
      <Teleport to={container}>
        <Field.Root>
          <Slider.Root defaultValue={50}>
            <Slider.Label>Volume</Slider.Label>
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        </Field.Root>
      </Teleport>,
    );

    const errors: ErrorEvent[] = [];
    function handleError(event: ErrorEvent) {
      event.preventDefault();
      errors.push(event);
    }
    window.addEventListener('error', handleError);

    try {
      within(container).getByText('Volume').click();
      await flushMicrotasks();

      expect(errors).toHaveLength(0);
    } finally {
      window.removeEventListener('error', handleError);
      unmount();
    }
  });

  it('keeps the id that the root gives it when the consumer sets an `id`', async () => {
    // The type of the part omits `id`, as upstream does. A consumer with no types can still pass it.
    const untypedProps = { id: 'custom' };
    await render(
      <Slider.Root id="volume" defaultValue={50}>
        <Slider.Label {...untypedProps} data-testid="label">
          Volume
        </Slider.Label>
        <Slider.Control>
          <Slider.Thumb />
        </Slider.Control>
      </Slider.Root>,
    );

    expect(screen.getByTestId('label')).toHaveAttribute('id', 'volume-label');
    expect(screen.getByRole('slider')).toHaveAttribute('aria-labelledby', 'volume-label');
  });

  it('names the root and the thumb, with no axe violation', async () => {
    const { container } = await render(
      <Slider.Root defaultValue={30}>
        <Slider.Label>Volume</Slider.Label>
        <Slider.Control>
          <Slider.Thumb />
        </Slider.Control>
      </Slider.Root>,
    );

    await expectNoAxeViolations(container);
    expect(screen.getByRole('slider')).toHaveAccessibleName('Volume');
    expect(screen.getByRole('group')).toHaveAccessibleName('Volume');
  });

  describe('KeepAlive', () => {
    it('keeps its link to the root and to the thumbs when KeepAlive hides the slider and shows it again', async () => {
      const visible = shallowRef(true);
      const Content = defineComponent(() => () => (
        <Slider.Root id="price" defaultValue={[20, 80]}>
          <Slider.Label>Price</Slider.Label>
          <Slider.Control>
            <Slider.Thumb />
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>
      ));
      const App = defineComponent(() => () => (
        <KeepAlive>{visible.value ? <Content /> : null}</KeepAlive>
      ));
      await render(<App />);

      function readLinks() {
        return {
          root: screen.getByRole('group').getAttribute('aria-labelledby'),
          inputs: screen
            .getAllByRole('slider')
            .map((input) => input.getAttribute('aria-labelledby')),
        };
      }
      expect(readLinks()).toEqual({
        root: 'price-label',
        inputs: ['price-label', 'price-label'],
      });

      visible.value = false;
      await flushMicrotasks();
      visible.value = true;
      await flushMicrotasks();

      expect(readLinks()).toEqual({
        root: 'price-label',
        inputs: ['price-label', 'price-label'],
      });
    });
  });

  describe('hydration', () => {
    const FIXTURE = 'src/slider/label/SliderLabelHydration.test.vue';

    it.each([
      { name: 'before the control', props: { label: 'before' as const } },
      { name: 'after the control', props: { label: 'after' as const } },
      {
        name: 'after the control, with indexes',
        props: { label: 'after' as const, explicitIndex: true },
      },
    ])('hydrates with the label $name, with no mismatch', async ({ props }) => {
      const serverHtml = await renderOnServer(FIXTURE, props);

      // A server writes the id of the label in the root and in each input, in each order of the parts.
      // A `<template>` element parses the HTML with no side effect.
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      expect(
        template.content.querySelector('[role="group"]')?.getAttribute('aria-labelledby'),
      ).toBe('price-label');
      const serverInputs = [...template.content.querySelectorAll('input[type="range"]')];
      expect(serverInputs.map((input) => input.getAttribute('aria-labelledby'))).toEqual([
        'price-label',
        'price-label',
      ]);

      const { container } = await hydrate(SliderLabelHydration, { serverHtml, props });

      expect(within(container).getByTestId('label')).toHaveAttribute('id', 'price-label');
      expect(
        within(container)
          .getAllByRole('slider')
          .map((input) => input.getAttribute('aria-labelledby')),
      ).toEqual(['price-label', 'price-label']);
    });
  });

  it('does nothing when a Field slider has no thumb to focus', async () => {
    const { user } = await render(
      <Field.Root>
        <Slider.Root defaultValue={50}>
          <Slider.Label data-testid="label">Volume</Slider.Label>
          <Slider.Control />
        </Slider.Root>
      </Field.Root>,
    );

    await user.click(screen.getByTestId('label'));

    expect(document.body).toHaveFocus();
  });
});
