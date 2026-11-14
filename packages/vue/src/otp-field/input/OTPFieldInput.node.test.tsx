import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { OTPField } from '@vase-ui/vue/otp-field';

function tag(html: string, pattern: RegExp) {
  return html.match(pattern)?.[0] ?? '';
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
  });
});
