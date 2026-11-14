import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { Field } from '@vase-ui/vue/field';
import * as Select from '../index.parts';

// Vue writes a comment around each fragment and slot.
function withoutComments(html: string) {
  return html.replace(/<!--.*?-->/g, '');
}

// The attributes of the first element that has the test id.
function readAttributes(html: string, testId: string) {
  const tag = new RegExp(`<[a-z]+[^>]*data-testid="${testId}"[^>]*>`).exec(html)?.[0] ?? '';
  return Object.fromEntries(
    [...tag.matchAll(/ ([a-z-]+)(?:="([^"]*)")?/g)].map(([, name, value]) => [name, value ?? '']),
  );
}

describe('<Select.Root /> on a server', () => {
  it('renders the label of the value and the hidden input of a closed select', async () => {
    const html = await renderToString(
      <Select.Root id="font" name="font" defaultValue="serif" items={{ serif: 'Serif' }}>
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
      </Select.Root>,
    );

    expect(withoutComments(html)).toMatch(
      /^<button type="button" tabindex="0" id="font" role="combobox" aria-expanded="false" aria-haspopup="listbox"><span>Serif<\/span><\/button><input name="font" value="serif" style="[^"]+" tabindex="-1" aria-hidden="true">$/,
    );
  });

  it('renders the placeholder state and a `type="hidden"` input for a select with no value and no name', async () => {
    const html = await renderToString(
      <Select.Root id="font">
        <Select.Trigger data-testid="trigger">
          <Select.Value data-testid="value" placeholder="Pick a font" />
        </Select.Trigger>
      </Select.Root>,
    );

    expect(readAttributes(html, 'trigger')).toHaveProperty('data-placeholder', '');
    expect(readAttributes(html, 'value')).toHaveProperty('data-placeholder', '');
    expect(withoutComments(html)).toContain('>Pick a font</span>');
    expect(html).toMatch(/<input id="font-hidden-input" type="hidden" value style="[^"]+"/);
  });

  it('renders one named input for each value of a multiple select', async () => {
    const html = await renderToString(
      <Select.Root multiple name="tags" defaultValue={['b', 'c']}>
        <Select.Trigger />
      </Select.Root>,
    );

    expect(html).toContain('<input type="hidden" name="tags" value="b">');
    expect(html).toContain('<input type="hidden" name="tags" value="c">');
  });

  describe('VUE-51: a label of the select', () => {
    it.each([
      { name: 'before the trigger', label: 'before' },
      { name: 'after the trigger', label: 'after' },
    ])('names the trigger with a label $name', async ({ label }) => {
      const html = await renderToString(
        <Select.Root id="font">
          {label === 'before' && <Select.Label data-testid="label">Font</Select.Label>}
          <Select.Trigger data-testid="trigger" />
          {label === 'after' && <Select.Label data-testid="label">Font</Select.Label>}
        </Select.Root>,
      );

      expect(readAttributes(html, 'label').id).toBe('font-label');
      expect(readAttributes(html, 'trigger')['aria-labelledby']).toBe('font-label');
    });
  });

  describe('VUE-17: a select in a field', () => {
    it('names the label and the messages of the field that come after the trigger', async () => {
      const html = await renderToString(
        <Field.Root invalid>
          <Select.Root>
            <Select.Trigger data-testid="trigger" />
          </Select.Root>
          <Field.Label data-testid="label">Font</Field.Label>
          <Field.Description data-testid="description">The font of the page</Field.Description>
          <Field.Error data-testid="error" match>
            Pick a font
          </Field.Error>
        </Field.Root>,
      );
      const trigger = readAttributes(html, 'trigger');
      const labelId = readAttributes(html, 'label').id;

      expect(labelId).toMatch(/^vase-ui-./);
      expect(trigger['aria-labelledby']).toBe(labelId);
      expect(trigger['aria-describedby']).toBe(
        `${readAttributes(html, 'description').id} ${readAttributes(html, 'error').id}`,
      );
    });

    it('gives a trigger with no label no `aria-labelledby`', async () => {
      const html = await renderToString(
        <Field.Root>
          <Select.Root>
            <Select.Trigger data-testid="trigger" />
          </Select.Root>
        </Field.Root>,
      );

      expect(readAttributes(html, 'trigger')).not.toHaveProperty('aria-labelledby');
    });
  });
});
