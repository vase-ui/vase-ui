import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { OTPField } from '@vase-ui/vue/otp-field';
import OTPFieldRootHydration from '../root/OTPFieldRootHydration.test.vue';

const SLOT = /<input(?![^>]*aria-hidden)[^>]*>/g;

function tag(html: string, pattern: RegExp) {
  return html.match(pattern)?.[0] ?? '';
}

function attribute(element: string, name: string) {
  return element.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
}

describe('<OTPField.Input />', () => {
  describe('server-side rendering', () => {
    it.each([
      { name: 'no `autocorrect` of the consumer', props: {}, expected: ['off'] },
      { name: 'an `autocorrect` of the consumer', props: { autocorrect: 'on' }, expected: ['on'] },
    ])('renders one `autocorrect` attribute on a slot with $name', async ({ props, expected }) => {
      const html = await renderToString(
        <OTPField.Root length={1}>
          <OTPField.Input {...props} />
        </OTPField.Root>,
      );
      const slot = tag(html, /<input[^>]*enterkeyhint[^>]*>/);

      expect(Array.from(slot.matchAll(/ autocorrect="([^"]*)"/g), (match) => match[1])).toEqual(
        expected,
      );
    });

    it.each([
      { name: 'no value', defaultValue: '', tabindex: ['0', '-1', '-1', '-1'] },
      { name: 'a value', defaultValue: '12', tabindex: ['-1', '-1', '0', '-1'] },
      { name: 'a complete value', defaultValue: '1234', tabindex: ['-1', '-1', '-1', '0'] },
    ])(
      'renders the character of each slot and one tab stop for $name',
      async ({ defaultValue, tabindex }) => {
        const html = await renderToString(
          <OTPField.Root length={4} defaultValue={defaultValue}>
            {Array.from({ length: 4 }, (_, index) => (
              <OTPField.Input key={index} />
            ))}
          </OTPField.Root>,
        );
        const slots = html.match(SLOT) ?? [];

        // An empty slot has no `value` attribute.
        expect(slots.map((slot) => attribute(slot, 'value'))).toEqual(
          Array.from({ length: 4 }, (_, index) => defaultValue[index]),
        );
        expect(slots.map((slot) => attribute(slot, 'tabindex'))).toEqual(tabindex);
      },
    );

    it.each([
      { name: 'before the field', label: 'before' as const },
      { name: 'after the field', label: 'after' as const },
    ])(
      'names each slot with the label $name, and the label names the first slot',
      async ({ label }) => {
        const html = await renderToString(
          <OTPFieldRootHydration label={label} description inputs={4} />,
        );
        const labelTag = tag(html, /<label[^>]*data-testid="label"[^>]*>/);
        const labelId = attribute(labelTag, 'id');
        const slots = html.match(SLOT) ?? [];

        expect(labelId).toBeTruthy();
        expect(slots.map((slot) => attribute(slot, 'aria-labelledby'))).toEqual(
          Array(4).fill(labelId),
        );
        // The description names the group and not each slot.
        expect(slots.map((slot) => attribute(slot, 'aria-describedby'))).toEqual(
          Array(4).fill(undefined),
        );
        expect(attribute(labelTag, 'for')).toBe(attribute(slots[0] ?? '', 'id'));
      },
    );
  });
});
