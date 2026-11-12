import { expect, describe, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { Fieldset } from '@vase-ui/vue/fieldset';

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
