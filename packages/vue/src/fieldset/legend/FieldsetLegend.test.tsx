import { expect, describe, it } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import { Fieldset } from '@vase-ui/vue/fieldset';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  hydrate,
  isJSDOM,
  renderOnServer,
  screen,
  takeReportedMessages,
  within,
} from '#test-utils';
import FieldsetLegendHydration from './FieldsetLegendHydration.test.vue';

describe('<Fieldset.Legend />', () => {
  const { render } = createRenderer();

  describeConformance(<Fieldset.Legend />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<Fieldset.Root>{node}</Fieldset.Root>);
    },
  }));

  it('should set aria-labelledby on the fieldset automatically', async () => {
    await render(
      <Fieldset.Root>
        <Fieldset.Legend data-testid="legend">Legend</Fieldset.Legend>
      </Fieldset.Root>,
    );

    expect(screen.getByRole('group')).toHaveAttribute(
      'aria-labelledby',
      screen.getByTestId('legend').id,
    );
  });

  it('should set aria-labelledby on the fieldset with custom id', async () => {
    await render(
      <Fieldset.Root>
        <Fieldset.Legend id="legend-id" />
      </Fieldset.Root>,
    );

    expect(screen.getByRole('group')).toHaveAttribute('aria-labelledby', 'legend-id');
  });

  it('reflects the disabled state', async () => {
    await render(
      <Fieldset.Root disabled>
        <Fieldset.Legend data-testid="legend">Legend</Fieldset.Legend>
      </Fieldset.Root>,
    );

    expect(screen.getByTestId('legend')).toHaveAttribute('data-disabled');
  });

  it('reflects the disabled state of an outer root', async () => {
    await render(
      <Fieldset.Root disabled>
        <Fieldset.Root>
          <Fieldset.Legend data-testid="legend">Legend</Fieldset.Legend>
        </Fieldset.Root>
      </Fieldset.Root>,
    );

    expect(screen.getByTestId('legend')).toHaveAttribute('data-disabled');
  });

  it('updates and clears the legend association', async () => {
    const App = defineComponent(() => {
      const legendId = shallowRef('legend-a');
      const showLegend = shallowRef(true);

      return () => (
        <>
          <Fieldset.Root>
            {showLegend.value ? (
              <Fieldset.Legend id={legendId.value}>Legend</Fieldset.Legend>
            ) : null}
          </Fieldset.Root>
          <button
            type="button"
            onClick={() => {
              legendId.value = 'legend-b';
            }}
          >
            Change id
          </button>
          <button
            type="button"
            onClick={() => {
              showLegend.value = false;
            }}
          >
            Remove legend
          </button>
        </>
      );
    });

    await render(<App />);

    const fieldset = screen.getByRole('group');
    expect(fieldset).toHaveAttribute('aria-labelledby', 'legend-a');

    await fireEvent.click(screen.getByRole('button', { name: 'Change id' }));
    expect(fieldset).toHaveAttribute('aria-labelledby', 'legend-b');

    await fireEvent.click(screen.getByRole('button', { name: 'Remove legend' }));
    expect(fieldset).not.toHaveAttribute('aria-labelledby');
  });

  it('throws a descriptive error when rendered outside <Fieldset.Root>', async () => {
    await expect(render(<Fieldset.Legend />)).rejects.toThrow(
      'Vase UI: A part of Fieldset must be inside <Fieldset.Root>. Without a root the legend has no fieldset to name. Put the part inside <Fieldset.Root>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });

  it.skipIf(isJSDOM)(
    'sets `aria-labelledby` after hydration without a custom legend id',
    async () => {
      const serverHtml = await renderOnServer(
        'src/fieldset/legend/FieldsetLegendHydration.test.vue',
      );

      // A `<template>` element parses the HTML with no side effect.
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      const serverFieldset = template.content.querySelector('[data-testid="fieldset"]')!;
      const legendId = template.content.querySelector('[data-testid="legend"]')!.id;
      expect(legendId).not.toBe('');
      // Base UI has no `aria-labelledby` here. The root of Vase UI assumes a legend until it is
      // mounted, so the server HTML has the id of the legend.
      expect(serverFieldset.getAttribute('aria-labelledby')).toBe(legendId);

      const { container } = await hydrate(FieldsetLegendHydration, { serverHtml });

      expect(within(container).getByTestId('fieldset')).toHaveAttribute(
        'aria-labelledby',
        legendId,
      );
    },
  );

  it('hydrates a legend that has an id of its own, and the root then has that id', async () => {
    const props = { legendId: 'own-legend' };
    const serverHtml = await renderOnServer(
      'src/fieldset/legend/FieldsetLegendHydration.test.vue',
      props,
    );

    const { container } = await hydrate(FieldsetLegendHydration, { serverHtml, props });

    expect(within(container).getByTestId('legend')).toHaveAttribute('id', 'own-legend');
    expect(within(container).getByTestId('fieldset')).toHaveAttribute(
      'aria-labelledby',
      'own-legend',
    );
  });
});
