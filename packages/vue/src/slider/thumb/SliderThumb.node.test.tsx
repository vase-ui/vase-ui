import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { Field } from '@vase-ui/vue/field';
import { Slider } from '@vase-ui/vue/slider';

function tag(html: string, pattern: RegExp) {
  return html.match(pattern)?.[0] ?? '';
}

describe('<Slider.Thumb /> on a server', () => {
  it('VUE-29: renders the index, the value and the text of the value of each thumb that has no `index` prop', async () => {
    const html = await renderToString(
      <Slider.Root defaultValue={[25, 75]}>
        <Slider.Control>
          <Slider.Thumb />
          <Slider.Thumb />
        </Slider.Control>
      </Slider.Root>,
    );

    const indexes = [...html.matchAll(/<div [^>]*data-index="(\d+)"[^>]*>/g)].map(
      ([, index]) => index,
    );
    const inputs = [...html.matchAll(/<input [^>]*>/g)].map(([input]) => ({
      value: / aria-valuenow="([^"]*)"/.exec(input)?.[1],
      text: / aria-valuetext="([^"]*)"/.exec(input)?.[1],
    }));

    expect(indexes).toEqual(['0', '1']);
    expect(inputs).toEqual([
      { value: '25', text: '25 start range' },
      { value: '75', text: '75 end range' },
    ]);
  });

  it.each([
    { name: 'before the control', label: 'before' as const },
    { name: 'after the control', label: 'after' as const },
  ])('names the input with the label of the field $name', async ({ label }) => {
    // The label is in the root, so only the thumb can wait for a label that comes after it.
    const fieldLabel = <Field.Label data-testid="label">Volume</Field.Label>;
    const html = await renderToString(
      <Field.Root>
        <Slider.Root defaultValue={30}>
          {label === 'before' ? fieldLabel : null}
          <Slider.Control>
            <Slider.Thumb />
          </Slider.Control>
          {label === 'after' ? fieldLabel : null}
        </Slider.Root>
      </Field.Root>,
    );
    const labelId = / id="([^"]+)"/.exec(tag(html, /<[^>]*data-testid="label"[^>]*>/))?.[1];

    expect(labelId).toBeTruthy();
    expect(tag(html, /<input [^>]*>/)).toContain(` aria-labelledby="${labelId}"`);
  });

  it('names no label on an input when no label exists', async () => {
    const html = await renderToString(
      <Slider.Root defaultValue={30}>
        <Slider.Control>
          <Slider.Thumb />
        </Slider.Control>
      </Slider.Root>,
    );

    expect(tag(html, /<input [^>]*>/)).not.toContain('aria-labelledby');
  });

  it.each([
    { thumbAlignment: 'edge' as const, scripts: 1 },
    { thumbAlignment: 'edge-client-only' as const, scripts: 0 },
    { thumbAlignment: 'center' as const, scripts: 0 },
  ])(
    'renders $scripts script for a range slider with the alignment $thumbAlignment',
    async ({ thumbAlignment, scripts }) => {
      const html = await renderToString(
        <Slider.Root defaultValue={[25, 75]} thumbAlignment={thumbAlignment}>
          <Slider.Control>
            <Slider.Thumb />
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>,
      );

      expect(html.match(/<script/g) ?? []).toHaveLength(scripts);
      if (scripts > 0) {
        // The script finds the thumbs that come before it, so it is in the last thumb.
        const afterLastInput = html.slice(html.lastIndexOf('<input'));
        expect(afterLastInput).toContain('<script');
        expect(afterLastInput.slice(0, afterLastInput.indexOf('<script'))).not.toContain('</div>');
      }
    },
  );
});
