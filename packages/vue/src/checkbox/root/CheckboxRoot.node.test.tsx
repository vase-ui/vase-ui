import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { Checkbox } from '@vase-ui/vue/checkbox';
import { Field } from '@vase-ui/vue/field';
import FieldScope from '../../../test/fixtures/FieldScope.vue';
import LabelableLabel from '../../../test/fixtures/LabelableLabel.vue';
import LabelableMessage from '../../../test/fixtures/LabelableMessage.vue';
import CheckboxRootHydration from './CheckboxRootHydration.test.vue';

function tag(html: string, pattern: RegExp) {
  return html.match(pattern)?.[0] ?? '';
}

function readId(html: string, testId: string) {
  return tag(html, new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`)).match(/ id="([^"]+)"/)?.[1];
}

describe('<Checkbox.Root />', () => {
  describe('server-side rendering', () => {
    it.each([
      { name: 'a checkbox that is off', props: {}, checked: false, mixed: false },
      {
        name: 'a checkbox that is on',
        props: { defaultChecked: true },
        checked: true,
        mixed: false,
      },
      {
        name: 'a controlled checkbox that is on',
        props: { checked: true },
        checked: true,
        mixed: false,
      },
      {
        name: 'an indeterminate checkbox',
        props: { indeterminate: true },
        checked: false,
        mixed: true,
      },
      {
        name: 'an indeterminate checkbox that is on',
        props: { indeterminate: true, defaultChecked: true },
        checked: true,
        mixed: true,
      },
    ])('renders $name with no DOM', async ({ props, checked, mixed }) => {
      expect(typeof document).toBe('undefined');

      const html = await renderToString(<CheckboxRootHydration name="notifications" {...props} />);
      const root = tag(html, /<span[^>]*role="checkbox"[^>]*>/);
      const input = tag(html, /<input[^>]*type="checkbox"[^>]*>/);

      expect(root).toContain(` aria-checked="${mixed ? 'mixed' : checked}"`);
      expect(root).toContain(' aria-label="Notifications"');
      expect(root).toContain(' tabindex="0"');
      expect(/ data-checked[ >]/.test(root)).toBe(checked && !mixed);
      expect(/ data-unchecked[ >]/.test(root)).toBe(!checked && !mixed);
      expect(/ data-indeterminate[ >]/.test(root)).toBe(mixed);
      expect(/ checked[ >]/.test(input)).toBe(checked);
      expect(input).not.toContain('indeterminate');
      expect(input).toContain(' name="notifications"');
      expect(input).toContain(' aria-hidden="true"');
      expect(input).toContain(' tabindex="-1"');
      expect(input).not.toContain(' value=');
    });

    it.each([
      { name: 'the unchecked value when off', props: {}, hidden: true },
      {
        name: 'no unchecked value when on',
        props: { defaultChecked: true },
        hidden: false,
      },
      {
        name: 'no unchecked value with no name',
        props: { name: undefined },
        hidden: false,
      },
    ])('renders $name', async ({ props, hidden }) => {
      const html = await renderToString(
        <CheckboxRootHydration name="notifications" value="yes" uncheckedValue="no" {...props} />,
      );

      expect(html.match(/<input[^>]*type="hidden"[^>]*>/g) ?? []).toEqual(
        hidden ? ['<input type="hidden" name="notifications" value="no">'] : [],
      );
      expect(tag(html, /<input[^>]*type="checkbox"[^>]*>/)).toContain(' value="yes"');
    });

    it('renders the states of a checkbox that is disabled, read-only and required', async () => {
      const html = await renderToString(<CheckboxRootHydration disabled readOnly required />);
      const root = tag(html, /<span[^>]*role="checkbox"[^>]*>/);
      const input = tag(html, /<input[^>]*type="checkbox"[^>]*>/);

      expect(root).toContain(' aria-disabled="true"');
      expect(root).toContain(' aria-readonly="true"');
      expect(root).toContain(' aria-required="true"');
      expect(root).toContain(' data-disabled');
      expect(root).toContain(' data-readonly');
      expect(root).toContain(' data-required');
      expect(/ disabled[ >]/.test(root)).toBe(false);
      expect(/ disabled[ >]/.test(input)).toBe(true);
      expect(/ required[ >]/.test(input)).toBe(true);
    });

    it.each([
      { name: 'before the checkbox', label: 'before' as const },
      { name: 'after the checkbox', label: 'after' as const },
    ])('names the checkbox with a label of the provider $name', async ({ label }) => {
      const html = await renderToString(<CheckboxRootHydration label={label} />);
      const root = tag(html, /<span[^>]*role="checkbox"[^>]*>/);
      const input = tag(html, /<input[^>]*type="checkbox"[^>]*>/);
      const labelTag = tag(html, /<label[^>]*data-testid="label"[^>]*>/);
      const labelId = labelTag.match(/ id="([^"]+)"/)?.[1];
      const inputId = input.match(/ id="([^"]+)"/)?.[1];

      expect(labelId).toBeTruthy();
      expect(root).toContain(` aria-labelledby="${labelId}"`);
      expect(labelTag).toContain(` for="${inputId}"`);
    });

    it('names and describes the checkbox with the label and the messages that come after it', async () => {
      const html = await renderToString(
        <Field.Root>
          <Checkbox.Root />
          <LabelableLabel data-testid="label">Notifications</LabelableLabel>
          <LabelableMessage data-testid="description">Description</LabelableMessage>
          <LabelableMessage data-testid="error">Error</LabelableMessage>
        </Field.Root>,
      );
      const root = tag(html, /<span[^>]*role="checkbox"[^>]*>/);
      const input = tag(html, /<input[^>]*type="checkbox"[^>]*>/);
      const labelId = readId(html, 'label');
      const describedBy = `${readId(html, 'description')} ${readId(html, 'error')}`;

      expect(labelId).toBeTruthy();
      expect(root).toContain(` aria-labelledby="${labelId}"`);
      expect(root).toContain(` aria-describedby="${describedBy}"`);
      expect(input).toContain(` aria-describedby="${describedBy}"`);
    });

    it('only describes the checkbox when the field has no label', async () => {
      const html = await renderToString(
        <Field.Root>
          <Checkbox.Root />
          <LabelableMessage data-testid="description">Description</LabelableMessage>
        </Field.Root>,
      );
      const root = tag(html, /<span[^>]*role="checkbox"[^>]*>/);

      expect(root).not.toContain('aria-labelledby');
      expect(root).toContain(` aria-describedby="${readId(html, 'description')}"`);
    });

    it('gives the checkbox no `aria-labelledby` from a native label, which a server cannot find', async () => {
      const html = await renderToString(<CheckboxRootHydration label="native" />);

      expect(tag(html, /<span[^>]*role="checkbox"[^>]*>/)).not.toContain('aria-labelledby');
    });

    it('gives the id of the control to a native button and not to the input', async () => {
      const html = await renderToString(<CheckboxRootHydration label="before" nativeButton />);
      const root = tag(html, /<button[^>]*role="checkbox"[^>]*>/);
      const input = tag(html, /<input[^>]*type="checkbox"[^>]*>/);
      const labelFor = tag(html, /<label[^>]*data-testid="label"[^>]*>/).match(
        / for="([^"]+)"/,
      )?.[1];

      expect(labelFor).toBeTruthy();
      expect(root).toContain(` id="${labelFor}"`);
      expect(input).not.toContain(' id=');
    });

    it.each([
      { name: 'has `data-filled` for a checkbox on', defaultChecked: true },
      { name: 'has no `data-filled` for a checkbox off', defaultChecked: false },
    ])('in a field, $name', async ({ defaultChecked }) => {
      const html = await renderToString(
        <FieldScope>
          <Checkbox.Root defaultChecked={defaultChecked} />
        </FieldScope>,
      );

      expect(/ data-filled[ >]/.test(tag(html, /<span[^>]*role="checkbox"[^>]*>/))).toBe(
        defaultChecked,
      );
    });
  });
});
