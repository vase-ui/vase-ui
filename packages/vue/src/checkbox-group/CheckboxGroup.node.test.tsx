import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { Checkbox } from '@vase-ui/vue/checkbox';
import { CheckboxGroup } from '@vase-ui/vue/checkbox-group';
import { Field } from '@vase-ui/vue/field';
import CheckboxGroupHydration from './CheckboxGroupHydration.test.vue';

// The attribute order in the HTML is not part of the test.
function readTag(html: string, testId: string) {
  return html.match(new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`))?.[0] ?? '';
}

function readAttribute(html: string, testId: string, name: string) {
  return readTag(html, testId).match(new RegExp(` ${name}="([^"]*)"`))?.[1];
}

function hasAttribute(html: string, testId: string, name: string) {
  return new RegExp(` ${name}[ =>]`).test(readTag(html, testId));
}

function readInputs(html: string) {
  return html.match(/<input[^>]*type="checkbox"[^>]*>/g) ?? [];
}

describe('<CheckboxGroup />', () => {
  describe('server-side rendering', () => {
    it('renders the group, the states of the checkboxes and their inputs with no DOM', async () => {
      expect(typeof document).toBe('undefined');

      const html = await renderToString(<CheckboxGroupHydration defaultValue={['banana']} />);
      const [apple, banana] = readInputs(html);

      expect(readAttribute(html, 'group', 'role')).toBe('group');
      expect(readAttribute(html, 'apple', 'aria-checked')).toBe('false');
      expect(readAttribute(html, 'banana', 'aria-checked')).toBe('true');
      expect(apple).not.toMatch(/ checked[ >]/);
      expect(banana).toMatch(/ checked[ >]/);
      expect(apple).toContain(' name="fruits"');
      expect(banana).toContain(' name="fruits"');
      expect(apple).toMatch(/ value(=""| |>)/);
      expect(banana).toContain(' value="banana"');
    });

    it.each([
      { name: 'a value', defaultValue: ['banana'], filled: true },
      { name: 'a value that no checkbox has', defaultValue: ['cherry'], filled: true },
      { name: 'no value', defaultValue: [], filled: false },
    ])(
      'renders `data-filled` on the parts after the group for $name',
      async ({ defaultValue, filled }) => {
        const html = await renderToString(
          <CheckboxGroupHydration defaultValue={defaultValue} label="after" />,
        );

        expect(hasAttribute(html, 'label', 'data-filled')).toBe(filled);
        expect(hasAttribute(html, 'description', 'data-filled')).toBe(filled);
      },
    );

    it('renders a disabled group and its checkboxes as disabled', async () => {
      const html = await renderToString(<CheckboxGroupHydration disabled />);

      expect(hasAttribute(html, 'group', 'data-disabled')).toBe(true);
      expect(readAttribute(html, 'apple', 'aria-disabled')).toBe('true');
      expect(readAttribute(html, 'banana', 'aria-disabled')).toBe('true');
      expect(readInputs(html).every((input) => / disabled[ >]/.test(input))).toBe(true);
    });

    it.each([
      { name: 'before the group', label: 'before' as const },
      { name: 'after the group', label: 'after' as const },
    ])('names the group with a label that comes $name', async ({ label }) => {
      const html = await renderToString(<CheckboxGroupHydration label={label} />);
      const labelId = readAttribute(html, 'label', 'id');

      expect(labelId).toBeTruthy();
      expect(readAttribute(html, 'group', 'aria-labelledby')).toBe(labelId);
    });

    it('gives the checkboxes of a group that shares the scope of the field one id each', async () => {
      const html = await renderToString(
        <Field.Root name="fruits">
          <CheckboxGroup>
            <Checkbox.Root value="apple" />
            <Checkbox.Root value="banana" />
          </CheckboxGroup>
        </Field.Root>,
      );
      const ids = Array.from(html.matchAll(/ id="([^"]+)"/g), (match) => match[1]);

      expect(ids).toHaveLength(4);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
