import { expect, describe, it } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import { Checkbox } from '@vase-ui/vue/checkbox';
import { CheckboxGroup } from '@vase-ui/vue/checkbox-group';
import { Field } from '@vase-ui/vue/field';
import { Fieldset } from '@vase-ui/vue/fieldset';
import { RadioGroup } from '@vase-ui/vue/radio-group';
import { Slider } from '@vase-ui/vue/slider';
import {
  createRenderer,
  describeConformance,
  expectNoAxeViolations,
  fireEvent,
  hydrate,
  renderOnServer,
  screen,
  within,
} from '#test-utils';
import FieldsetLegendHydration from '../legend/FieldsetLegendHydration.test.vue';

type RenderSlotProps = { props: Record<string, unknown> };

describe('<Fieldset.Root />', () => {
  const { render } = createRenderer();

  describeConformance(<Fieldset.Root />, () => ({
    refInstanceof: window.HTMLFieldSetElement,
    render,
  }));

  it('sets the native disabled attribute', async () => {
    await render(
      <Fieldset.Root disabled data-testid="fieldset">
        <input />
      </Fieldset.Root>,
    );

    expect(screen.getByTestId('fieldset')).toHaveAttribute('disabled');
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('keeps nested fieldsets disabled when an ancestor fieldset is disabled', async () => {
    await render(
      <Fieldset.Root disabled>
        <Fieldset.Root>
          <Field.Root>
            <Field.Control data-testid="control" />
          </Field.Root>
        </Fieldset.Root>
      </Fieldset.Root>,
    );

    expect(screen.getByTestId('control')).toHaveAttribute('disabled');
  });

  it('updates nested disabled precedence in both directions', async () => {
    const App = defineComponent(() => {
      const outerDisabled = shallowRef(false);
      const innerDisabled = shallowRef(true);

      return () => (
        <>
          <Fieldset.Root disabled={outerDisabled.value}>
            <Fieldset.Root disabled={innerDisabled.value}>
              <Field.Root data-testid="root">
                <Field.Control data-testid="control" />
              </Field.Root>
            </Fieldset.Root>
          </Fieldset.Root>
          <button
            type="button"
            onClick={() => {
              outerDisabled.value = true;
            }}
          >
            Disable outer
          </button>
          <button
            type="button"
            onClick={() => {
              innerDisabled.value = false;
            }}
          >
            Enable inner
          </button>
          <button
            type="button"
            onClick={() => {
              outerDisabled.value = false;
            }}
          >
            Enable outer
          </button>
        </>
      );
    });

    await render(<App />);

    expect(screen.getByTestId('control')).toBeDisabled();
    expect(screen.getByTestId('root')).toHaveAttribute('data-disabled');
    await fireEvent.click(screen.getByRole('button', { name: 'Disable outer' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Enable inner' }));
    expect(screen.getByTestId('control')).toBeDisabled();
    expect(screen.getByTestId('root')).toHaveAttribute('data-disabled');
    await fireEvent.click(screen.getByRole('button', { name: 'Enable outer' }));
    expect(screen.getByTestId('control')).not.toBeDisabled();
    expect(screen.getByTestId('root')).not.toHaveAttribute('data-disabled');
  });

  it('passes disabled to rendered Base UI roots', async () => {
    await render(
      <div>
        <Fieldset.Root
          disabled
          v-slots={{
            render: ({ props }: RenderSlotProps) => (
              <RadioGroup {...props} data-testid="radio-group" />
            ),
          }}
        />
        <Fieldset.Root
          disabled
          v-slots={{
            render: ({ props }: RenderSlotProps) => (
              <CheckboxGroup {...props}>
                <Checkbox.Root name="apple" data-testid="checkbox" />
              </CheckboxGroup>
            ),
          }}
        />
        <Fieldset.Root
          disabled
          v-slots={{
            render: ({ props }: RenderSlotProps) => (
              <Slider.Root {...props} defaultValue={50}>
                <Slider.Control data-testid="slider-control">
                  <Slider.Track>
                    <Slider.Thumb />
                  </Slider.Track>
                </Slider.Control>
              </Slider.Root>
            ),
          }}
        />
      </div>,
    );

    expect(screen.getByTestId('radio-group')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('checkbox')).toHaveAttribute('data-disabled');
    expect(screen.getByTestId('slider-control')).toHaveAttribute('data-disabled');
  });

  it('sets no disabled attribute on an enabled root that renders a div', async () => {
    await render(<Fieldset.Root as="div" data-testid="root" />);

    expect(screen.getByTestId('root')).not.toHaveAttribute('disabled');
  });

  describe('nested roots', () => {
    it('disables an inner root inside a disabled outer root', async () => {
      await render(
        <Fieldset.Root disabled>
          <Fieldset.Root data-testid="inner">
            <input />
          </Fieldset.Root>
        </Fieldset.Root>,
      );

      const inner = screen.getByTestId('inner');
      expect(inner).toHaveAttribute('disabled');
      expect(inner).toHaveAttribute('data-disabled');
    });

    it('follows a change of the disabled prop of the outer and of the inner root', async () => {
      const App = defineComponent(() => {
        const outerDisabled = shallowRef(false);
        const innerDisabled = shallowRef(true);

        return () => (
          <>
            <Fieldset.Root disabled={outerDisabled.value}>
              <Fieldset.Root disabled={innerDisabled.value} data-testid="inner">
                <input />
              </Fieldset.Root>
            </Fieldset.Root>
            <button
              type="button"
              onClick={() => {
                outerDisabled.value = true;
              }}
            >
              Disable outer
            </button>
            <button
              type="button"
              onClick={() => {
                innerDisabled.value = false;
              }}
            >
              Enable inner
            </button>
            <button
              type="button"
              onClick={() => {
                outerDisabled.value = false;
              }}
            >
              Enable outer
            </button>
            <button
              type="button"
              onClick={() => {
                innerDisabled.value = true;
              }}
            >
              Disable inner
            </button>
          </>
        );
      });

      await render(<App />);

      const inner = screen.getByTestId('inner');
      const input = screen.getByRole('textbox');

      expect(inner).toHaveAttribute('data-disabled');
      expect(input).toBeDisabled();

      await fireEvent.click(screen.getByRole('button', { name: 'Disable outer' }));
      expect(inner).toHaveAttribute('data-disabled');
      expect(input).toBeDisabled();

      await fireEvent.click(screen.getByRole('button', { name: 'Enable inner' }));
      expect(inner).toHaveAttribute('data-disabled');
      expect(input).toBeDisabled();

      await fireEvent.click(screen.getByRole('button', { name: 'Enable outer' }));
      expect(inner).not.toHaveAttribute('data-disabled');
      expect(inner).not.toHaveAttribute('disabled');
      expect(input).not.toBeDisabled();

      await fireEvent.click(screen.getByRole('button', { name: 'Disable inner' }));
      expect(inner).toHaveAttribute('data-disabled');
      expect(input).toBeDisabled();
    });
  });

  describe('aria-labelledby', () => {
    it('has no aria-labelledby when it has no legend', async () => {
      await render(<Fieldset.Root />);

      expect(screen.getByRole('group')).not.toHaveAttribute('aria-labelledby');
    });

    it('uses the aria-labelledby of the consumer, not the id of the legend', async () => {
      await render(
        <Fieldset.Root aria-labelledby="other-legend">
          <Fieldset.Legend id="own-legend">Legend</Fieldset.Legend>
        </Fieldset.Root>,
      );

      expect(screen.getByRole('group')).toHaveAttribute('aria-labelledby', 'other-legend');
    });
  });

  describe('accessibility', () => {
    it('has no axe violation with a legend and a labelled input', async () => {
      const { container } = await render(
        <Fieldset.Root>
          <Fieldset.Legend>Shipping address</Fieldset.Legend>
          <label>
            Street
            <input />
          </label>
        </Fieldset.Root>,
      );

      await expectNoAxeViolations(container);
    });
  });

  describe('hydration', () => {
    it.each([
      { name: 'enabled', disabled: false },
      { name: 'disabled', disabled: true },
    ])(
      'hydrates the $name root with no legend, and the root then has no aria-labelledby',
      async ({ disabled }) => {
        const props = { disabled };
        const serverHtml = await renderOnServer('src/fieldset/root/FieldsetRoot.vue', props);

        // The server HTML assumes a legend until the root is mounted.
        // A `<template>` element parses the HTML with no side effect.
        const template = document.createElement('template');
        template.innerHTML = serverHtml;
        expect(template.content.querySelector('fieldset')?.getAttribute('aria-labelledby')).toMatch(
          /^vase-ui-./,
        );

        const { container } = await hydrate(Fieldset.Root, { serverHtml, props });

        expect(within(container).getByRole('group')).not.toHaveAttribute('aria-labelledby');
      },
    );

    it('hydrates a root that has an aria-label and a legend, and the legend then names the root', async () => {
      const props = { ariaLabel: 'Billing' };
      const serverHtml = await renderOnServer(
        'src/fieldset/legend/FieldsetLegendHydration.test.vue',
        props,
      );

      // The server cannot know that the legend exists, so the root has no `aria-labelledby` yet.
      // A `<template>` element parses the HTML with no side effect.
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      expect(
        template.content.querySelector('fieldset')?.getAttribute('aria-labelledby'),
      ).toBeNull();

      const { container } = await hydrate(FieldsetLegendHydration, { serverHtml, props });

      expect(within(container).getByRole('group')).toHaveAttribute(
        'aria-labelledby',
        within(container).getByTestId('legend').id,
      );
    });
  });
});
