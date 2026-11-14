import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import * as OTPField from '../index.parts';
import OTPFieldRootHydration from './OTPFieldRootHydration.test.vue';

function tag(html: string, pattern: RegExp) {
  return html.match(pattern)?.[0] ?? '';
}

function attribute(element: string, name: string) {
  return new RegExp(` ${name}="([^"]*)"`).exec(element)?.[1];
}

function hasAttribute(element: string, name: string) {
  return new RegExp(` ${name}[ =>]`).test(element);
}

const GROUP = /<div[^>]*role="group"[^>]*>/;
const HIDDEN_INPUT = /<input[^>]*aria-hidden="true"[^>]*>/;

describe('<OTPField.Root />', () => {
  describe('server-side rendering', () => {
    it('renders the group and the hidden input with the attributes of the form', async () => {
      expect(typeof document).toBe('undefined');

      const html = await renderToString(
        <OTPField.Root length={6} name="otp" defaultValue="12" required />,
      );
      const group = tag(html, GROUP);
      const input = tag(html, HIDDEN_INPUT);

      expect(hasAttribute(group, 'data-filled')).toBe(true);
      expect(hasAttribute(group, 'data-complete')).toBe(false);
      expect(hasAttribute(group, 'data-value')).toBe(false);
      expect(hasAttribute(group, 'data-length')).toBe(false);
      expect(attribute(input, 'type')).toBe('text');
      expect(attribute(input, 'name')).toBe('otp');
      expect(attribute(input, 'value')).toBe('12');
      expect(attribute(input, 'minlength')).toBe('6');
      expect(attribute(input, 'maxlength')).toBe('6');
      expect(attribute(input, 'pattern')).toBe('\\d{6}');
      expect(attribute(input, 'autocomplete')).toBe('one-time-code');
      expect(attribute(input, 'inputmode')).toBe('numeric');
      expect(attribute(input, 'tabindex')).toBe('-1');
      expect(hasAttribute(input, 'required')).toBe(true);
      expect(hasAttribute(input, 'disabled')).toBe(false);
      expect(hasAttribute(input, 'readonly')).toBe(false);
    });

    it.each([
      { type: 'numeric', pattern: '\\d{6}', inputMode: 'numeric' },
      { type: 'alpha', pattern: '[a-zA-Z]{6}', inputMode: 'text' },
      { type: 'alphanumeric', pattern: '[a-zA-Z0-9]{6}', inputMode: 'text' },
      { type: 'none', pattern: undefined, inputMode: undefined },
    ] as const)(
      'renders the pattern and the input mode of the validation type $type',
      async ({ type, pattern, inputMode }) => {
        const html = await renderToString(
          <OTPField.Root length={6} name="otp" validationType={type} />,
        );
        const input = tag(html, HIDDEN_INPUT);

        expect(attribute(input, 'pattern')).toBe(pattern);
        expect(attribute(input, 'inputmode')).toBe(inputMode);
      },
    );

    it('renders the `autoComplete`, the `inputMode` and the `form` of the part on the hidden input', async () => {
      const html = await renderToString(
        <OTPField.Root length={6} name="otp" autoComplete="off" inputMode="tel" form="checkout" />,
      );
      const input = tag(html, HIDDEN_INPUT);

      expect(attribute(input, 'autocomplete')).toBe('off');
      expect(attribute(input, 'inputmode')).toBe('tel');
      expect(attribute(input, 'form')).toBe('checkout');
    });

    it.each([
      { name: 'a field that is complete', props: { defaultValue: '123456' }, complete: true },
      { name: 'a controlled field that is complete', props: { value: '123456' }, complete: true },
      {
        name: 'a value with extra characters',
        props: { defaultValue: '12a34b56c7' },
        complete: true,
      },
      { name: 'a field that is not complete', props: { defaultValue: '123' }, complete: false },
    ])('renders the value of $name', async ({ props, complete }) => {
      const html = await renderToString(<OTPField.Root length={6} name="otp" {...props} />);

      expect(attribute(tag(html, HIDDEN_INPUT), 'value')).toBe(
        complete ? '123456' : props.defaultValue,
      );
      expect(hasAttribute(tag(html, GROUP), 'data-complete')).toBe(complete);
    });

    it('renders the states of a field that is disabled, read-only and required', async () => {
      const html = await renderToString(
        <OTPField.Root length={6} name="otp" disabled readOnly required />,
      );
      const group = tag(html, GROUP);
      const input = tag(html, HIDDEN_INPUT);

      expect(hasAttribute(group, 'data-disabled')).toBe(true);
      expect(hasAttribute(group, 'data-readonly')).toBe(true);
      expect(hasAttribute(group, 'data-required')).toBe(true);
      expect(hasAttribute(input, 'disabled')).toBe(true);
      expect(hasAttribute(input, 'readonly')).toBe(true);
      expect(hasAttribute(input, 'required')).toBe(true);
    });

    it('gives the hidden input the fallback id when the field has no name, and no id with a name', async () => {
      const unnamed = await renderToString(<OTPField.Root length={6} id="verification-code" />);
      const named = await renderToString(
        <OTPField.Root length={6} id="verification-code" name="otp" />,
      );

      expect(attribute(tag(unnamed, HIDDEN_INPUT), 'id')).toBe('verification-code-hidden-input');
      expect(attribute(tag(named, HIDDEN_INPUT), 'id')).toBeUndefined();
    });

    it.each([
      { name: 'zero', length: 0 },
      { name: 'a negative number', length: -1 },
      { name: 'a fraction', length: 3.7 },
      { name: 'not a number', length: Number.NaN },
      { name: 'infinity', length: Number.POSITIVE_INFINITY },
    ])('renders no hidden input for a length that is $name', async ({ length }) => {
      const html = await renderToString(<OTPField.Root length={length} name="otp" />);

      expect(html).not.toContain('<input');
      expect(tag(html, GROUP)).not.toBe('');
    });

    it.each([
      { name: 'before the field', label: 'before' as const },
      { name: 'after the field', label: 'after' as const },
    ])(
      'names and describes the group with the label $name and the description',
      async ({ label }) => {
        const html = await renderToString(<OTPFieldRootHydration label={label} description />);
        const labelTag = tag(html, /<label[^>]*data-testid="label"[^>]*>/);
        const labelId = attribute(labelTag, 'id');
        const descriptionId = attribute(tag(html, /<p[^>]*data-testid="description"[^>]*>/), 'id');
        const group = tag(html, GROUP);
        const input = tag(html, HIDDEN_INPUT);

        expect(labelId).toBeTruthy();
        expect(descriptionId).toBeTruthy();
        expect(attribute(group, 'aria-labelledby')).toBe(labelId);
        expect(attribute(group, 'aria-describedby')).toBe(descriptionId);
        expect(attribute(input, 'aria-describedby')).toBe(descriptionId);
        expect(attribute(labelTag, 'for')).toBeTruthy();
      },
    );

    it('gives the group no `aria-labelledby` when the field has no label', async () => {
      const html = await renderToString(<OTPFieldRootHydration />);

      expect(attribute(tag(html, GROUP), 'aria-labelledby')).toBeUndefined();
    });

    it.each([
      { name: 'a value', props: { defaultValue: '12' }, filled: true },
      { name: 'no value', props: {}, filled: false },
    ])(
      'in a field, gives the group and the label after it `data-filled` for $name',
      async ({ props, filled }) => {
        const html = await renderToString(<OTPFieldRootHydration label="after" {...props} />);

        expect(hasAttribute(tag(html, GROUP), 'data-filled')).toBe(filled);
        expect(hasAttribute(tag(html, /<label[^>]*data-testid="label"[^>]*>/), 'data-filled')).toBe(
          filled,
        );
      },
    );
  });
});
