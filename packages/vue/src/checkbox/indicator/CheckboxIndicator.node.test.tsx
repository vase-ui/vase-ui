import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import CheckboxIndicatorHydration from './CheckboxIndicatorHydration.test.vue';

function readIndicator(html: string) {
  return /<span[^>]*data-testid="indicator"[^>]*>/.exec(html)?.[0] ?? '';
}

describe('<Checkbox.Indicator />', () => {
  describe('server-side rendering', () => {
    it.each([
      {
        name: 'a checkbox that is on',
        props: { defaultChecked: true },
        attribute: 'data-checked',
      },
      {
        name: 'an indeterminate checkbox',
        props: { indeterminate: true },
        attribute: 'data-indeterminate',
      },
      {
        name: 'a kept indicator that is off',
        props: { keepMounted: true },
        attribute: 'data-unchecked',
      },
    ])('renders the indicator of $name with no DOM', async ({ props, attribute }) => {
      expect(typeof document).toBe('undefined');

      const indicator = readIndicator(
        await renderToString(<CheckboxIndicatorHydration {...props} />),
      );

      expect(indicator).toContain(` ${attribute}`);
      expect(indicator.match(/ data-(checked|unchecked|indeterminate)/g)).toEqual([
        ` ${attribute}`,
      ]);
      // A style rule for these attributes would hide the indicator until the page hydrates.
      expect(indicator).not.toContain('data-starting-style');
      expect(indicator).not.toContain('data-ending-style');
    });

    it('renders no indicator for a checkbox that is off', async () => {
      const html = await renderToString(<CheckboxIndicatorHydration />);

      expect(html).toContain('role="checkbox"');
      expect(readIndicator(html)).toBe('');
    });
  });
});
