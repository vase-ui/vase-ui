import { describe, expect, it, vi } from 'vitest';
import { createSSRApp, defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { useSwipeDismiss } from './useSwipeDismiss';

describe('useSwipeDismiss on a server', () => {
  it('renders the movement variables at 0px and calls no getter of the caller', async () => {
    const elementRef = vi.fn(() => null);
    const swipeThreshold = vi.fn(() => 10);
    const enabled = vi.fn(() => true);
    const directions = vi.fn(() => ['down' as const]);
    const Box = defineComponent(() => {
      const swipe = useSwipeDismiss({
        enabled,
        directions,
        elementRef,
        swipeThreshold,
        movementCssVars: { x: '--x', y: '--y' },
      });

      return () => <div style={swipe.getDragStyles()} {...swipe.pointerProps} />;
    });

    const html = await renderToString(createSSRApp(Box));

    expect(html).toBe('<div style="--x:0px;--y:0px;"></div>');
    expect(elementRef).not.toHaveBeenCalled();
    expect(swipeThreshold).not.toHaveBeenCalled();
    expect(enabled).not.toHaveBeenCalled();
    expect(directions).not.toHaveBeenCalled();
  });
});
