import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import RadioIndicatorHydration from './RadioIndicatorHydration.test.vue';

// The data attributes of the indicator in the HTML, or `null` when the HTML has no indicator.
// The order of the attributes is not part of the test.
function readDataAttributes(html: string, testId: string) {
  const tag = new RegExp(`<span[^>]*data-testid="${testId}"[^>]*>`).exec(html)?.[0];
  if (tag === undefined) {
    return null;
  }

  return (tag.match(/ data-[\w-]+/g) ?? [])
    .map((attribute) => attribute.trim())
    .filter((attribute) => attribute !== 'data-testid')
    .sort();
}

describe('<Radio.Indicator />', () => {
  describe('server-side rendering', () => {
    // No indicator has a transition attribute in the server HTML. A style rule for `data-starting-style`
    // can hide the indicator, and no animation shows it again before the page hydrates.
    it.each([
      {
        name: 'the indicator of the checked radio only',
        props: { defaultValue: 'b' },
        indicatorA: null,
        indicatorB: ['data-checked'],
      },
      {
        name: 'no indicator when no radio is checked',
        props: {},
        indicatorA: null,
        indicatorB: null,
      },
      {
        name: 'each indicator with `keepMounted`',
        props: { defaultValue: 'b', keepMounted: true },
        indicatorA: ['data-unchecked'],
        indicatorB: ['data-checked'],
      },
    ])('renders $name with no DOM', async ({ props, indicatorA, indicatorB }) => {
      expect(typeof document).toBe('undefined');

      const html = await renderToString(<RadioIndicatorHydration {...props} />);

      expect(readDataAttributes(html, 'indicator-a')).toEqual(indicatorA);
      expect(readDataAttributes(html, 'indicator-b')).toEqual(indicatorB);
    });
  });
});
