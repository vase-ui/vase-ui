import { expect, describe, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { Meter } from '@vase-ui/vue/meter';
import { mockRuntimeLocale } from '../../../test/mockRuntimeLocale';

describe('<Meter.Root /> on a server', () => {
  it('renders the label id, the width of the indicator and the hidden node', async () => {
    const html = await renderToString(
      <Meter.Root value={30}>
        <Meter.Label>Battery Level</Meter.Label>
        <Meter.Value />
        <Meter.Track>
          <Meter.Indicator />
        </Meter.Track>
      </Meter.Root>,
    );

    // The generated id has another form in each version of Vue.
    const id = /aria-labelledby="([^"]*)"/.exec(html)?.[1];
    expect(id).toMatch(/^vase-ui-./);
    expect(html).toBe(
      [
        `<div aria-labelledby="${id}" aria-valuemax="100" aria-valuemin="0" aria-valuenow="30" aria-valuetext="30%" role="meter">`,
        '<!--[--><!--[--><!--[-->',
        `<span id="${id}" role="presentation"><!--[-->Battery Level<!--]--></span>`,
        '<span aria-hidden="true"><!--[-->30%<!--]--></span>',
        '<div><!--[-->',
        '<div style="inset-inline-start:0;height:inherit;width:30%;"><!--[--><!--]--></div>',
        '<!--]--></div>',
        '<!--]--><!--]-->',
        '<span role="presentation" style="clip-path:inset(50%);overflow:hidden;white-space:nowrap;border:0;padding:0;width:1px;height:1px;margin:0;position:fixed;top:-1px;left:0;">x</span>',
        '<!--]--></div>',
      ].join(''),
    );
  });

  it.each([
    { name: 'an aria-label', attributes: { 'aria-label': 'Battery' }, labelledBy: undefined },
    {
      name: 'an aria-labelledby',
      attributes: { 'aria-labelledby': 'outside' },
      labelledBy: 'outside',
    },
  ])(
    'renders no aria-labelledby of its own on a root that the consumer names: $name',
    async ({ attributes, labelledBy }) => {
      const html = await renderToString(<Meter.Root value={30} {...attributes} />);

      expect(/aria-labelledby="([^"]*)"/.exec(html)?.[1]).toBe(labelledBy);
      expect(html).not.toContain('vase-ui-');
    },
  );

  it('renders the generated id in the aria-labelledby of a root with a blank aria-label', async () => {
    const html = await renderToString(<Meter.Root value={30} aria-label="  " />);

    expect(/aria-labelledby="([^"]*)"/.exec(html)?.[1]).toMatch(/^vase-ui-./);
  });

  it('formats with en-US, and not with the runtime locale', async () => {
    const format = { maximumFractionDigits: 1 };
    mockRuntimeLocale('de-DE');

    const html = await renderToString(
      <Meter.Root value={1234.5} max={2000} format={format}>
        <Meter.Value />
      </Meter.Root>,
    );

    const expected = (1234.5).toLocaleString('en-US', format);
    expect(html).toContain(`aria-valuetext="${expected}"`);
    expect(html).toContain(`<!--[-->${expected}<!--]-->`);
  });
});
