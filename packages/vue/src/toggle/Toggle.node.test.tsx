import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import ToggleHydration from './ToggleHydration.test.vue';

describe('<Toggle />', () => {
  describe('server-side rendering', () => {
    it.each([
      { name: 'a toggle', props: {}, pressed: 'false', dataPressed: false, disabled: false },
      {
        name: 'a pressed toggle',
        props: { defaultPressed: true },
        pressed: 'true',
        dataPressed: true,
        disabled: false,
      },
      {
        name: 'a disabled toggle',
        props: { disabled: true },
        pressed: 'false',
        dataPressed: false,
        disabled: true,
      },
    ])('renders $name with no DOM', async ({ props, pressed, dataPressed, disabled }) => {
      expect(typeof document).toBe('undefined');

      const html = await renderToString(<ToggleHydration {...props} />);
      const tag = /^<button[^>]*>/.exec(html)?.[0] ?? '';

      expect(tag).toContain(' type="button"');
      expect(tag).toContain(' tabindex="0"');
      expect(tag).toContain(` aria-pressed="${pressed}"`);
      expect(/ data-pressed[ >]/.test(tag)).toBe(dataPressed);
      expect(/ disabled[ >]/.test(tag)).toBe(disabled);
      expect(/ data-disabled[ >]/.test(tag)).toBe(disabled);
    });
  });
});
