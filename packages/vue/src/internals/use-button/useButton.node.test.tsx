import { expect, describe, it } from 'vitest';
import { defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { useButton } from './useButton';

describe('useButton', () => {
  describe('server-side rendering', () => {
    it('should server-side render', async () => {
      expect(typeof document).toBe('undefined');

      const TestButton = defineComponent(
        (props: { disabled?: boolean | undefined }) => {
          const { attributes } = useButton(null, { disabled: () => props.disabled, native: false });

          return () => <span {...attributes.value} />;
        },
        { props: ['disabled'], inheritAttrs: false },
      );

      const html = await renderToString(<TestButton disabled />);

      expect(html).toBe('<span role="button" tabindex="-1" aria-disabled="true"></span>');
    });

    it('adds disabled attribute', async () => {
      const TestButton = defineComponent(
        (props: { disabled?: boolean | undefined }) => {
          const { attributes } = useButton(null, { disabled: () => props.disabled });

          return () => <button {...attributes.value}>Submit</button>;
        },
        { props: ['disabled'], inheritAttrs: false },
      );

      const html = await renderToString(<TestButton disabled />);

      expect(html).toBe('<button type="button" tabindex="0" disabled>Submit</button>');
    });
  });
});
