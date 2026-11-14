import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { Field } from '@vase-ui/vue/field';
import { Slider } from '@vase-ui/vue/slider';

function tag(html: string, pattern: RegExp) {
  return html.match(pattern)?.[0] ?? '';
}

function readId(html: string, testId: string) {
  return / id="([^"]+)"/.exec(tag(html, new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`)))?.[1];
}

const GROUP = /<div[^>]*role="group"[^>]*>/;
const CONTROL = /<div[^>]*data-testid="control"[^>]*>/;
const INPUTS = /<input [^>]*>/g;

describe('<Slider.Root /> on a server', () => {
  it('renders the group with its id, and the id that its label will have', async () => {
    const html = await renderToString(
      <Slider.Root id="volume" defaultValue={30}>
        <Slider.Control />
      </Slider.Root>,
    );

    expect(html).toBe(
      [
        '<div data-orientation="horizontal" aria-labelledby="volume-label" id="volume" role="group">',
        '<!--[--><div data-orientation="horizontal"><!--[--><!--]--></div><!--]-->',
        '</div>',
      ].join(''),
    );
  });

  it.each([
    { name: 'an aria-label', attributes: { 'aria-label': 'Volume' }, labelledBy: undefined },
    {
      name: 'an aria-labelledby',
      attributes: { 'aria-labelledby': 'outside' },
      labelledBy: 'outside',
    },
  ])(
    'renders no aria-labelledby of its own on a root that the consumer names: $name',
    async ({ attributes, labelledBy }) => {
      const html = await renderToString(<Slider.Root id="volume" {...attributes} />);

      expect(/aria-labelledby="([^"]*)"/.exec(tag(html, GROUP))?.[1]).toBe(labelledBy);
    },
  );

  it('renders the id of its label on a root with a blank aria-label', async () => {
    const html = await renderToString(<Slider.Root id="volume" aria-label="  " />);

    expect(tag(html, GROUP)).toContain(' aria-labelledby="volume-label"');
  });

  it.each([
    { name: 'before the slider', label: 'before' as const },
    { name: 'after the slider', label: 'after' as const },
  ])('names the root with the label of the field $name', async ({ label }) => {
    const fieldLabel = <Field.Label data-testid="label">Volume</Field.Label>;
    const html = await renderToString(
      <Field.Root>
        {label === 'before' ? fieldLabel : null}
        <Slider.Root id="volume" />
        {label === 'after' ? fieldLabel : null}
      </Field.Root>,
    );
    const labelId = readId(html, 'label');

    expect(labelId).toBeTruthy();
    expect(tag(html, GROUP)).toContain(` aria-labelledby="${labelId}"`);
  });

  it.each([
    { name: 'before the slider', description: 'before' as const },
    { name: 'after the slider', description: 'after' as const },
  ])('describes the root with the description of the field $name', async ({ description }) => {
    const fieldDescription = <Field.Description data-testid="description">Help</Field.Description>;
    const html = await renderToString(
      <Field.Root>
        {description === 'before' ? fieldDescription : null}
        <Slider.Root id="volume" />
        {description === 'after' ? fieldDescription : null}
      </Field.Root>,
    );
    const descriptionId = readId(html, 'description');

    expect(descriptionId).toBeTruthy();
    expect(tag(html, GROUP)).toContain(` aria-describedby="${descriptionId}"`);
  });

  it.each([
    { name: 'before the control', label: 'before' as const },
    { name: 'after the control', label: 'after' as const },
  ])(
    'VUE-29: links the label to the root and to the input of each thumb, with the label $name',
    async ({ label }) => {
      const sliderLabel = <Slider.Label data-testid="label">Price</Slider.Label>;
      const html = await renderToString(
        <Slider.Root id="price" defaultValue={[25, 75]}>
          {label === 'before' ? sliderLabel : null}
          <Slider.Control>
            <Slider.Thumb />
            <Slider.Thumb />
          </Slider.Control>
          {label === 'after' ? sliderLabel : null}
        </Slider.Root>,
      );

      expect(readId(html, 'label')).toBe('price-label');
      expect(tag(html, GROUP)).toContain(' aria-labelledby="price-label"');
      const inputs = html.match(INPUTS) ?? [];
      expect(inputs).toHaveLength(2);
      expect(inputs.every((input) => input.includes(' aria-labelledby="price-label"'))).toBe(true);
    },
  );

  it('marks the control for the script of an edge thumb', async () => {
    const html = await renderToString(
      <Slider.Root thumbAlignment="edge">
        <Slider.Control data-testid="control" />
      </Slider.Root>,
    );

    expect(tag(html, CONTROL)).toContain(' data-vase-ui-slider-control');
  });

  it.each([{ thumbAlignment: 'center' as const }, { thumbAlignment: 'edge-client-only' as const }])(
    'does not mark the control when thumbAlignment is $thumbAlignment',
    async ({ thumbAlignment }) => {
      const html = await renderToString(
        <Slider.Root thumbAlignment={thumbAlignment}>
          <Slider.Control data-testid="control" />
        </Slider.Root>,
      );

      expect(tag(html, CONTROL)).not.toContain('data-vase-ui-slider-control');
    },
  );
});
