import { expect, describe, it } from 'vitest';
import { defineComponent, KeepAlive, shallowRef } from 'vue';
import { Fieldset } from '@vase-ui/vue/fieldset';
import {
  createHeldBranch,
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
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

  it('names the fieldset with the legend only while KeepAlive shows the legend', async () => {
    const visible = shallowRef(true);
    const App = defineComponent(() => () => (
      <Fieldset.Root>
        <KeepAlive>
          {visible.value ? <Fieldset.Legend data-testid="legend">Legend</Fieldset.Legend> : null}
        </KeepAlive>
      </Fieldset.Root>
    ));
    await render(<App />);
    const fieldset = screen.getByRole('group');
    const legend = screen.getByTestId('legend');
    expect(fieldset).toHaveAttribute('aria-labelledby', legend.id);

    visible.value = false;
    await flushMicrotasks();
    expect(fieldset).not.toHaveAttribute('aria-labelledby');

    visible.value = true;
    await flushMicrotasks();
    // The same element proves that `KeepAlive` kept the legend and did not mount a new one.
    expect(screen.getByTestId('legend')).toBe(legend);
    expect(fieldset).toHaveAttribute('aria-labelledby', legend.id);
  });

  it('names the last legend after KeepAlive shows a legend that mounted while held', async () => {
    const { HeldBranch, hide, mountWhileHeld, show } = createHeldBranch(
      () => (
        <Fieldset.Legend key="b" id="legend-b">
          B
        </Fieldset.Legend>
      ),
      {
        renderBranch: (part) => (
          <div>
            <Fieldset.Legend key="a" id="legend-a">
              A
            </Fieldset.Legend>
            {part}
          </div>
        ),
      },
    );
    const App = defineComponent(() => () => (
      <Fieldset.Root>
        <HeldBranch />
      </Fieldset.Root>
    ));
    await render(<App />);
    const fieldset = screen.getByRole('group');
    const seen = [fieldset.getAttribute('aria-labelledby')];
    for (const change of [hide, mountWhileHeld, show, hide, show]) {
      await change();
      seen.push(fieldset.getAttribute('aria-labelledby'));
    }

    expect(seen).toEqual(['legend-a', null, null, 'legend-b', null, 'legend-b']);
  });

  it.skipIf(isJSDOM)(
    'sets `aria-labelledby` after hydration without a custom legend id',
    async () => {
      // An explicit name suppresses the assumed legend id in the server HTML (VUE-89).
      const props = { ariaLabel: 'Billing' };
      const serverHtml = await renderOnServer(
        'src/fieldset/legend/FieldsetLegendHydration.test.vue',
        props,
      );

      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      const serverFieldset = template.content.querySelector('[data-testid="fieldset"]')!;
      const legendId = template.content.querySelector('[data-testid="legend"]')!.id;
      expect(legendId).not.toBe('');
      expect(serverFieldset.getAttribute('aria-labelledby')).toBeNull();

      const { container } = await hydrate(FieldsetLegendHydration, { serverHtml, props });

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

  it('throws a descriptive error when rendered outside <Fieldset.Root>', async () => {
    await expect(render(<Fieldset.Legend />)).rejects.toThrow(
      'Vase UI: A part of Fieldset must be inside <Fieldset.Root>. Without a root the legend has no fieldset to name. Put the part inside <Fieldset.Root>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
