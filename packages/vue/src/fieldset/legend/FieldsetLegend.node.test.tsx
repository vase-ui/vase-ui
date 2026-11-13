import { expect, describe, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { Fieldset } from '@vase-ui/vue/fieldset';
import FieldsetLegendIdPart from '../../../test/fixtures/FieldsetLegendIdPart.vue';

describe('<Fieldset.Legend /> on a server', () => {
  it('renders the id of the legend in the aria-labelledby of the root', async () => {
    const html = await renderToString(
      <Fieldset.Root>
        <Fieldset.Legend>Legend</Fieldset.Legend>
      </Fieldset.Root>,
    );

    // The generated id has another form in each version of Vue.
    const id = /aria-labelledby="([^"]*)"/.exec(html)?.[1];
    expect(id).toMatch(/^vase-ui-./);
    expect(html).toBe(
      `<fieldset aria-labelledby="${id}"><!--[--><div id="${id}"><!--[-->Legend<!--]--></div><!--]--></fieldset>`,
    );
  });

  it('renders the generated id in the aria-labelledby of a root that has no legend', async () => {
    const html = await renderToString(<Fieldset.Root />);

    const id = /aria-labelledby="([^"]*)"/.exec(html)?.[1];
    expect(id).toMatch(/^vase-ui-./);
    expect(html).toBe(`<fieldset aria-labelledby="${id}"><!--[--><!--]--></fieldset>`);
  });

  it.each([
    { name: 'an aria-label', attributes: { 'aria-label': 'Billing' }, labelledBy: undefined },
    {
      name: 'an aria-labelledby',
      attributes: { 'aria-labelledby': 'outside' },
      labelledBy: 'outside',
    },
  ])(
    'renders no aria-labelledby of its own on a root that the consumer names: $name',
    async ({ attributes, labelledBy }) => {
      const html = await renderToString(<Fieldset.Root {...attributes} />);

      expect(/aria-labelledby="([^"]*)"/.exec(html)?.[1]).toBe(labelledBy);
      expect(html).not.toContain('vase-ui-');
    },
  );

  it('renders the generated id in the aria-labelledby of a root with a blank aria-label', async () => {
    const html = await renderToString(<Fieldset.Root aria-label="  " />);

    expect(/aria-labelledby="([^"]*)"/.exec(html)?.[1]).toMatch(/^vase-ui-./);
  });

  it('gives the context the id of the legend, and no id with no legend', async () => {
    const withLegend = await renderToString(
      <Fieldset.Root>
        <Fieldset.Legend>Legend</Fieldset.Legend>
        <FieldsetLegendIdPart />
      </Fieldset.Root>,
    );
    const withoutLegend = await renderToString(
      <Fieldset.Root>
        <FieldsetLegendIdPart />
      </Fieldset.Root>,
    );

    const legendId = /<div id="([^"]*)"/.exec(withLegend)?.[1];
    expect(legendId).toMatch(/^vase-ui-./);
    expect(withLegend).toContain(`data-legend-id="${legendId}"`);
    expect(withoutLegend).not.toContain('data-legend-id');
  });

  it('renders the disabled state on a disabled root and on its legend, and on no enabled part', async () => {
    const disabledHtml = await renderToString(
      <Fieldset.Root disabled>
        <Fieldset.Legend>Legend</Fieldset.Legend>
      </Fieldset.Root>,
    );
    const enabledHtml = await renderToString(
      <Fieldset.Root>
        <Fieldset.Legend>Legend</Fieldset.Legend>
      </Fieldset.Root>,
    );

    const id = /aria-labelledby="([^"]*)"/.exec(disabledHtml)?.[1];
    expect(disabledHtml).toBe(
      `<fieldset data-disabled aria-labelledby="${id}" disabled><!--[--><div data-disabled id="${id}"><!--[-->Legend<!--]--></div><!--]--></fieldset>`,
    );
    expect(enabledHtml).not.toContain('disabled');
  });
});
