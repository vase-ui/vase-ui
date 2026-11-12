import { describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { DirectionProvider, useDirection } from '@vase-ui/vue/direction-provider';

const DirectionProbe = defineComponent(() => {
  const direction = useDirection();
  return () => <span data-testid="direction">{direction.value}</span>;
});

describe('<DirectionProvider /> on a server', () => {
  it('renders the configured direction in a descendant', async () => {
    const html = await renderToString(
      <DirectionProvider direction="rtl">
        <DirectionProbe />
      </DirectionProvider>,
    );

    expect(html).toBe('<!--[--><span data-testid="direction">rtl</span><!--]-->');
  });
});
