import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { Checkbox } from '@vase-ui/vue/checkbox';
import { CheckboxGroup } from '@vase-ui/vue/checkbox-group';
import { Field } from '@vase-ui/vue/field';
import CheckboxGroupHydration from './CheckboxGroupHydration.test.vue';
import CheckboxGroupParentHydration from './CheckboxGroupParentHydration.test.vue';

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

    it.each([
      { name: 'no child on', defaultValue: [], state: 'false', hasChecked: false },
      { name: 'one child on', defaultValue: ['fuji'], state: 'mixed', hasChecked: false },
      { name: 'each child on', defaultValue: ['fuji', 'gala'], state: 'true', hasChecked: true },
    ])(
      'renders the parent with its state and its input with no name for $name',
      async ({ defaultValue, state, hasChecked }) => {
        const html = await renderToString(
          <CheckboxGroupParentHydration defaultValue={defaultValue} />,
        );
        const [parentInput, fujiInput] = readInputs(html);

        expect(readAttribute(html, 'parent', 'aria-checked')).toBe(state);
        expect(hasAttribute(html, 'parent', 'data-parent')).toBe(true);
        expect(hasAttribute(html, 'fuji', 'data-parent')).toBe(false);
        // The server cannot know the children that mount later, and HTML has no attribute for
        // `indeterminate`.
        expect(hasAttribute(html, 'parent', 'aria-controls')).toBe(false);
        expect(parentInput).not.toContain(' name=');
        expect(parentInput).not.toContain(' indeterminate');
        expect(/ checked[ >]/.test(parentInput ?? '')).toBe(hasChecked);
        expect(fujiInput).toContain(' name="apples"');
      },
    );

    it.each([false, true])(
      'keeps checkbox ids unique in a shared Field.Root during SSR (nativeButton=%s)',
      async (nativeButton) => {
        const html = await renderToString(
          <CheckboxGroupParentHydration nativeButton={nativeButton} />,
        );
        const ids = Array.from(html.matchAll(/ id="([^"]+)"/g), (match) => match[1]);

        expect(ids).toHaveLength(nativeButton ? 4 : 7);
        expect(new Set(ids).size).toBe(ids.length);
      },
    );

    it.each([
      { nativeButton: false, parent: false },
      { nativeButton: true, parent: false },
      { nativeButton: false, parent: true },
      { nativeButton: true, parent: true },
    ])(
      'associates Field.Label with a grouped Checkbox during SSR (nativeButton=$nativeButton, parent=$parent)',
      async ({ nativeButton, parent }) => {
        const html = await renderToString(
          <Field.Root name="apple">
            <CheckboxGroup allValues={['fuji']}>
              <Field.Item>
                <Field.Label data-testid="label">Fuji</Field.Label>
                <Checkbox.Root
                  parent={parent}
                  value={parent ? undefined : 'fuji'}
                  nativeButton={nativeButton}
                  as={nativeButton ? 'button' : undefined}
                  data-testid="checkbox"
                />
              </Field.Item>
            </CheckboxGroup>
          </Field.Root>,
        );

        const controlId = nativeButton
          ? readAttribute(html, 'checkbox', 'id')
          : readInputs(html)[0]?.match(/ id="([^"]*)"/)?.[1];

        expect(controlId).toBeTruthy();
        expect(readAttribute(html, 'label', 'for')).toBe(controlId);
      },
    );
  });
});
