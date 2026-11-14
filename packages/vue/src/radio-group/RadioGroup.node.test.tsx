import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';
import RadioGroupHydration from './RadioGroupHydration.test.vue';

// The attribute order in the HTML is not part of the test.
function readAttribute(html: string, testId: string, name: string) {
  const tag = html.match(new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`))?.[0];
  return tag?.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
}

function readAttributes(html: string, name: string) {
  return ['a', 'b', 'c'].map((testId) => readAttribute(html, testId, name));
}

describe('<RadioGroup />', () => {
  describe('VUE-2: server-side rendering', () => {
    it('renders the group, the states of the radios and their inputs with no DOM', async () => {
      expect(typeof document).toBe('undefined');

      const html = await renderToString(<RadioGroupHydration defaultValue="b" />);
      const inputs = html.match(/<input[^>]*type="radio"[^>]*>/g) ?? [];

      expect(html).toMatch(/^<div[^>]* role="radiogroup"/);
      expect(readAttributes(html, 'role')).toEqual(['radio', 'radio', 'radio']);
      expect(readAttributes(html, 'aria-checked')).toEqual(['false', 'true', 'false']);
      expect(inputs.map((input) => / checked[ >]/.test(input))).toEqual([false, true, false]);
    });

    it.each([
      {
        name: 'the checked radio',
        props: { defaultValue: 'b' },
        tabindexes: ['-1', '0', '-1'],
      },
      {
        name: 'the first radio, with no value',
        props: {},
        tabindexes: ['0', '-1', '-1'],
      },
      {
        name: 'the first enabled radio, with no value',
        props: { firstDisabled: true },
        tabindexes: ['-1', '0', '-1'],
      },
      {
        name: 'the checked radio that is disabled',
        props: { defaultValue: 'a', firstDisabled: true },
        tabindexes: ['0', '-1', '-1'],
      },
      {
        name: 'no radio for a value that no radio has',
        props: { defaultValue: 'z' },
        tabindexes: ['-1', '-1', '-1'],
      },
      {
        name: 'no radio of a disabled group',
        props: { defaultValue: 'b', disabled: true },
        tabindexes: ['-1', '-1', '-1'],
      },
    ])('gives the tab stop to $name', async ({ props, tabindexes }) => {
      const html = await renderToString(<RadioGroupHydration {...props} />);

      expect(readAttributes(html, 'tabindex')).toEqual(tabindexes);
    });

    it('names a radio in `Field.Item` with a label that comes after it', async () => {
      const html = await renderToString(
        <Field.Root>
          <RadioGroup>
            <Field.Item>
              <Radio.Root value="a" data-testid="a" />
              <Field.Label data-testid="label">Apple</Field.Label>
            </Field.Item>
          </RadioGroup>
        </Field.Root>,
      );
      const labelId = readAttribute(html, 'label', 'id');

      expect(labelId).toBeTruthy();
      expect(readAttribute(html, 'a', 'aria-labelledby')).toBe(labelId);
    });

    it('names a group in `Field.Root` with a label that comes after it', async () => {
      const html = await renderToString(
        <Field.Root>
          <RadioGroup data-testid="group">
            <Radio.Root value="a" />
          </RadioGroup>
          <Field.Label data-testid="label">Fruit</Field.Label>
        </Field.Root>,
      );
      const labelId = readAttribute(html, 'label', 'id');

      expect(labelId).toBeTruthy();
      expect(readAttribute(html, 'group', 'aria-labelledby')).toBe(labelId);
    });

    it('names the group and its radios with a description that comes after the group', async () => {
      const html = await renderToString(
        <Field.Root>
          <RadioGroup data-testid="group">
            <Radio.Root value="a" data-testid="a" />
          </RadioGroup>
          <Field.Description data-testid="description">Pick one.</Field.Description>
        </Field.Root>,
      );
      const descriptionId = readAttribute(html, 'description', 'id');

      expect(descriptionId).toBeTruthy();
      expect(readAttribute(html, 'group', 'aria-describedby')).toBe(descriptionId);
      expect(readAttribute(html, 'a', 'aria-describedby')).toBe(descriptionId);
    });

    it('names the group and its radios with an error that comes after the group', async () => {
      const html = await renderToString(
        <Form errors={{ fruit: 'Pick one.' }}>
          <Field.Root name="fruit">
            <RadioGroup data-testid="group">
              <Radio.Root value="a" data-testid="a" />
            </RadioGroup>
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );
      const errorId = readAttribute(html, 'error', 'id');

      expect(html).toContain('Pick one.');
      expect(errorId).toBeTruthy();
      expect(readAttribute(html, 'group', 'aria-invalid')).toBe('true');
      expect(readAttribute(html, 'group', 'aria-describedby')).toBe(errorId);
      expect(readAttribute(html, 'a', 'aria-describedby')).toBe(errorId);
    });
  });
});
